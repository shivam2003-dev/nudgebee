//go:build e2e

package agents

import (
	"bytes"
	"context"
	"fmt"
	"nudgebee/llm/agents/core"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

// ============================================================
// Benchmark fixture loader
// ============================================================
//
// Reads `test_case.yaml` files from `llm/benchmark/llm/agents/*/fixtures/*/`
// and converts them into k8sTestCase values so the Go integration tests can
// share the single source of truth maintained by the Python benchmark harness.
//
// Reuses:
//   - fixture YAML schema (agent, user_prompt, expected_output, before_test,
//     after_test, feature_flag, flag_variant, wait_time_seconds, tags, skip)
//   - feature-flag pattern for deterministic failure injection via the
//     OpenTelemetry demo (nudgebee-demo namespace)
//
// Does NOT reuse:
//   - RAGAS scoring (that path stays in the Python nightly runner)
//   - pytest parametrization / dashboard

// fixtureYAML mirrors the subset of test_case.yaml fields the Go runner needs.
// Fields we don't consume yet (scenario_id, type, include_files, ...) are
// deliberately omitted — yaml.v3 will ignore unknown keys.
type fixtureYAML struct {
	Agent             string            `yaml:"agent"`
	UserPrompt        string            `yaml:"user_prompt"`
	ExpectedOutput    []string          `yaml:"expected_output"`
	ExpectedRootCause expectedRootCause `yaml:"expected_root_cause"`
	Tags              []string          `yaml:"tags"`
	BeforeTest        string            `yaml:"before_test"`
	AfterTest         string            `yaml:"after_test"`
	SetupTimeout      int               `yaml:"setup_timeout"`    // seconds, default 300
	TeardownTimeout   int               `yaml:"teardown_timeout"` // seconds, default 120
	FeatureFlag       string            `yaml:"feature_flag"`
	FlagVariant       string            `yaml:"flag_variant"`
	WaitSeconds       int               `yaml:"wait_time_seconds"` // seconds to wait after setup
	Skip              bool              `yaml:"skip"`
	SkipReason        string            `yaml:"skip_reason"`
}

// expectedRootCause is the structured ground truth for an RCA fixture. The
// Python harness scores answers semantically via RAGAS; the Go fast-path
// tier uses this for narrow keyword presence checks (affected_service is
// usually a single high-signal token like "productcatalogservice").
type expectedRootCause struct {
	AffectedService string   `yaml:"affected_service"`
	IssueType       string   `yaml:"issue_type"`
	Symptoms        []string `yaml:"symptoms"`
}

// Fixture wraps a loaded benchmark test case with its lifecycle helpers.
type Fixture struct {
	// Path is the absolute or repo-relative path to test_case.yaml.
	Path string
	// ID is the parent directory name (e.g. "001_users_are_reporting...").
	ID string
	// Dir is the absolute path to the fixture directory (cwd for hooks).
	Dir string
	// YAML is the parsed document.
	YAML fixtureYAML
	// TestCase is the fixture converted into the integration-test schema.
	// Callers can further customise it (WantAnyToolMatching, WantMinToolCalls,
	// etc.) before passing to runTest.
	TestCase k8sTestCase
}

const (
	defaultSetupTimeout    = 300 * time.Second
	defaultTeardownTimeout = 120 * time.Second
)

// LoadFixture reads test_case.yaml at the given path and returns a Fixture.
// Honours the `skip:` field by calling t.Skip() with the reason.
func LoadFixture(t *testing.T, path string) *Fixture {
	t.Helper()

	abs, err := filepath.Abs(path)
	if err != nil {
		t.Fatalf("LoadFixture: resolve path %q: %v", path, err)
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		t.Fatalf("LoadFixture: read %q: %v", abs, err)
	}

	var y fixtureYAML
	if err := yaml.Unmarshal(raw, &y); err != nil {
		t.Fatalf("LoadFixture: parse %q: %v", abs, err)
	}
	if y.UserPrompt == "" {
		t.Fatalf("LoadFixture: %q: user_prompt is required", abs)
	}

	if y.Skip {
		reason := y.SkipReason
		if reason == "" {
			reason = "fixture marked skip"
		}
		t.Skipf("benchmark fixture skipped: %s", reason)
	}

	id := filepath.Base(filepath.Dir(abs))

	// Derive a stable session ID per fixture so the LLM cache / dedup works
	// across repeated runs. Truncate to keep the value short.
	sessionID := fmt.Sprintf("ut-bench-%s", clipString(sanitizeID(id), 48))

	tc := k8sTestCase{
		Name:      id,
		SessionId: sessionID,
		Query:     y.UserPrompt,
		AccountId: os.Getenv("TEST_ACCOUNT"),
		UserId:    os.Getenv("TEST_USER"),
	}

	// Default content check: a single high-signal token (the affected
	// service name) when the fixture provides expected_root_cause. This
	// matches reliably on free-form LLM answers — unlike `expected_output`,
	// which is a full ground-truth sentence intended for RAGAS-style
	// semantic scoring in the Python harness, not verbatim substring checks.
	// Tests can override or extend tc.WantContainsAny after LoadFixture.
	if svc := strings.TrimSpace(y.ExpectedRootCause.AffectedService); svc != "" {
		tc.WantContainsAny = []string{svc}
	}

	return &Fixture{
		Path:     abs,
		ID:       id,
		Dir:      filepath.Dir(abs),
		YAML:     y,
		TestCase: tc,
	}
}

// Setup runs before_test, enables any feature flag, and waits for the
// requested telemetry-settling period. Registers teardown via t.Cleanup
// BEFORE any mutating step so partial setup still gets cleaned up.
func (f *Fixture) Setup(t *testing.T) {
	t.Helper()

	// Register teardown FIRST. teardown is idempotent and only acts on the
	// fixture's declared state, so registering it before the flag flips or
	// before_test runs means a Fatalf mid-setup still triggers cleanup.
	t.Cleanup(func() { f.teardown(t) })

	// 1. before_test shell hook
	if f.YAML.BeforeTest != "" {
		timeout := time.Duration(f.YAML.SetupTimeout) * time.Second
		if timeout <= 0 {
			timeout = defaultSetupTimeout
		}
		if err := runShellHook(t, "before_test", f.YAML.BeforeTest, f.Dir, timeout); err != nil {
			t.Fatalf("[%s] before_test failed: %v", f.ID, err)
		}
	}

	// 2. feature flag enable (OpenTelemetry demo pattern)
	if f.YAML.FeatureFlag != "" {
		variant := f.YAML.FlagVariant
		if variant == "" {
			variant = "on"
		}
		if err := enableDemoFlag(t, f.YAML.FeatureFlag, variant); err != nil {
			t.Fatalf("[%s] enable flag %q: %v", f.ID, f.YAML.FeatureFlag, err)
		}
	}

	// 3. wait for telemetry to accumulate
	if f.YAML.WaitSeconds > 0 {
		t.Logf("[%s] waiting %ds for telemetry to accumulate", f.ID, f.YAML.WaitSeconds)
		time.Sleep(time.Duration(f.YAML.WaitSeconds) * time.Second)
	}
}

// teardown runs after_test and resets the feature flag. Failures are logged
// but do not fail the test (we don't want cleanup errors to mask real issues).
func (f *Fixture) teardown(t *testing.T) {
	t.Helper()

	if f.YAML.FeatureFlag != "" {
		if err := disableDemoFlag(t, f.YAML.FeatureFlag); err != nil {
			t.Logf("[%s] warning: disable flag %q: %v", f.ID, f.YAML.FeatureFlag, err)
		}
	}

	if f.YAML.AfterTest != "" {
		timeout := time.Duration(f.YAML.TeardownTimeout) * time.Second
		if timeout <= 0 {
			timeout = defaultTeardownTimeout
		}
		if err := runShellHook(t, "after_test", f.YAML.AfterTest, f.Dir, timeout); err != nil {
			t.Logf("[%s] warning: after_test failed: %v", f.ID, err)
		}
	}
}

// Agent resolves the NBAgent referenced by the fixture (or the given default
// if the fixture doesn't specify one).
func (f *Fixture) Agent(t *testing.T, fallback core.NBAgent) core.NBAgent {
	t.Helper()
	name := f.YAML.Agent
	if name == "" {
		return fallback
	}
	sc := newSC(f.TestCase)
	a, ok := core.GetNBAgent(sc, name, f.TestCase.AccountId, core.AgentStatusEnabled)
	if !ok {
		t.Fatalf("[%s] agent %q not registered / not enabled for account", f.ID, name)
	}
	return a
}

// runShellHook executes a multi-line shell script with a timeout and captures
// stdout/stderr into the test log.
func runShellHook(t *testing.T, label, script, cwd string, timeout time.Duration) error {
	t.Helper()
	t.Logf("[hook:%s] running (timeout=%s, cwd=%s)", label, timeout, cwd)

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	cmd.Dir = cwd
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	err := cmd.Run()
	elapsed := time.Since(start)

	if stdout.Len() > 0 {
		t.Logf("[hook:%s] stdout: %s", label, trimForLog(stdout.String()))
	}
	if stderr.Len() > 0 {
		t.Logf("[hook:%s] stderr: %s", label, trimForLog(stderr.String()))
	}

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("%s: timed out after %s", label, timeout)
		}
		return fmt.Errorf("%s: %w (elapsed=%s)", label, err, elapsed)
	}
	t.Logf("[hook:%s] ok in %s", label, elapsed)
	return nil
}

// trimForLog clips long hook output so test logs remain readable.
func trimForLog(s string) string { return clipString(s, 2048) }

func clipString(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// sanitizeID replaces filesystem/DB-unfriendly chars in a fixture id so it
// can be embedded in a session id.
func sanitizeID(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z',
			c >= 'A' && c <= 'Z',
			c >= '0' && c <= '9',
			c == '-', c == '_':
			out = append(out, c)
		default:
			out = append(out, '-')
		}
	}
	return string(out)
}

// skipIfNoDemoNamespace skips the test when the nudgebee-demo namespace (used
// by the OpenTelemetry demo + feature-flag scenarios) isn't present. Uses a
// short timeout so a hung/unreachable cluster doesn't block the test suite.
func skipIfNoDemoNamespace(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := exec.CommandContext(ctx, "kubectl", "get", "ns", "nudgebee-demo").Run(); err != nil {
		t.Skip("skipping: nudgebee-demo namespace not present (demo cluster required)")
	}
}
