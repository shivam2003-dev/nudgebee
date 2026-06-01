//go:build e2e

package agents

import (
	"os"
	"testing"
)

// ============================================================
// Benchmark-fixture-backed integration tests (proof of concept)
// ============================================================
//
// These tests demonstrate the Tier-C strategy: instead of depending on
// whatever state happens to exist in the dev cluster, they drive the
// benchmark YAML fixtures (the same source-of-truth the Python nightly
// harness consumes). The failure state is injected deterministically via
// OpenTelemetry-demo feature flags, so every run observes the same
// underlying condition.
//
// Skipped unless:
//   1. TEST_ACCOUNT / TEST_USER / TEST_TENANT are set (integration env)
//   2. kubectl can reach the `nudgebee-demo` namespace
//
// The Python benchmark runner keeps scoring these same fixtures nightly
// via RAGAS; the Go runner here asserts only the fast, deterministic
// property invariants we care about on every PR.

// fixturePath returns the absolute path to a benchmark fixture relative to
// this test file's package directory.
func fixturePath(id string) string {
	return "../../benchmark/llm/agents/rca/fixtures/" + id + "/test_case.yaml"
}

// TestK8sAgent_Fixture_ProductCatalogFailure drives the agent through the
// `productCatalogFailure` feature flag. The failure appears as 500 errors in
// logs/traces/metrics for productcatalogservice; a correct plan must reach
// at least one observability signal and the final answer must reference one
// of the fixture's expected output phrases.
func TestK8sAgent_Fixture_ProductCatalogFailure(t *testing.T) {
	skipIfNoK8sTestEnv(t)
	skipIfNoDemoNamespace(t)

	f := LoadFixture(t, fixturePath("001_users_are_reporting_they_cannot_browse_p"))
	f.Setup(t) // auto-teardown via t.Cleanup

	tc := f.TestCase
	// Tighten: any investigation of a 500-error service must touch at least
	// one of logs, traces, or metrics; the benchmark fixture's
	// expected_output already drives WantContainsAny via LoadFixture.
	tc.WantAnyToolMatching = []string{"logs", "loki", "trace", "prometheus", "metric", "kubectl"}
	tc.WantMinToolCalls = 2

	agent := f.Agent(t, newK8sDebugAgent(os.Getenv("TEST_ACCOUNT")))
	runTestMinimal(t, agent, tc)
}

// TestK8sAgent_Fixture_AdServiceGC covers the `adManualGc` feature flag.
// Symptom: intermittent latency spikes from manual full GC. The agent should
// reach for trace/metric signals; log-only investigation would miss the
// root cause.
func TestK8sAgent_Fixture_AdServiceGC(t *testing.T) {
	skipIfNoK8sTestEnv(t)
	skipIfNoDemoNamespace(t)

	f := LoadFixture(t, fixturePath("004_the_ad_service_is_experiencing_intermitt"))
	f.Setup(t)

	tc := f.TestCase
	tc.WantAnyToolMatching = []string{"trace", "prometheus", "metric", "logs"}
	tc.WantMinToolCalls = 2

	agent := f.Agent(t, newK8sDebugAgent(os.Getenv("TEST_ACCOUNT")))
	runTestMinimal(t, agent, tc)
}

// TestK8sAgent_Fixture_AdServiceHighCPU covers the `adHighCpu` feature flag.
// Symptom: saturated CPU impacting latency. Metrics are the primary signal.
func TestK8sAgent_Fixture_AdServiceHighCPU(t *testing.T) {
	skipIfNoK8sTestEnv(t)
	skipIfNoDemoNamespace(t)

	f := LoadFixture(t, fixturePath("009_the_ad_service_is_consuming_excessive_cp"))
	f.Setup(t)

	tc := f.TestCase
	tc.WantAnyToolMatching = []string{"prometheus", "metric", "kubectl_top", "trace"}
	tc.WantMinToolCalls = 2

	agent := f.Agent(t, newK8sDebugAgent(os.Getenv("TEST_ACCOUNT")))
	runTestMinimal(t, agent, tc)
}
