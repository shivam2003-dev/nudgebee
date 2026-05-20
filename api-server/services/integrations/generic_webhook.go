package integrations

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"nudgebee/services/common"
	"nudgebee/services/config"
	"nudgebee/services/integrations/core"
	"nudgebee/services/security"
	"sync"
	"time"

	"github.com/google/uuid"
)

// workflowMappingCache memoizes parsed workflow_mapping rule lists keyed by
// raw JSON string. workflow_mapping is static for a given integration row,
// but ProcessEventWebook runs on every incoming webhook — caching avoids
// re-unmarshaling on the hot path. Entries are stable across the process
// lifetime; if a user updates the mapping, the raw string changes and the
// new key takes a separate slot.
var workflowMappingCache sync.Map

func init() {
	core.RegisterIntegration(WorkflowWebhook{})
}

type WorkflowWebhook struct {
}

const IntegrationGenericWebhook = "workflow_webhook"

func (m WorkflowWebhook) Name() string {
	return IntegrationGenericWebhook
}

func (m WorkflowWebhook) Category() core.IntegrationCategory {
	return core.IntegrationCategoryIncidentWebhook
}

func (m WorkflowWebhook) ConfigSchema() core.IntegrationSchema {
	return core.IntegrationSchema{
		Type:     core.ToolSchemaTypeObject,
		Required: []string{},
		Properties: map[string]core.IntegrationSchemaProperty{
			"integration_config_name": {
				Type:             core.ToolSchemaTypeString,
				Description:      "Name of Workflow Webhook",
				Default:          "",
				AutoGenerateFunc: "",
			},
			"account_id": {
				Type:             core.ToolSchemaTypeArray,
				Description:      "Select Account(s)",
				Default:          "",
				AutoGenerateFunc: "listAccounts",
				// Multi-select: a workflow_webhook can route to workflows
				// across multiple accounts via workflow_mapping rules. The
				// fallback workflow_id is set per-binding by the trigger
				// sidebar in whichever account that workflow lives in.
			},
			"token": {
				Type:             core.ToolSchemaTypeString,
				Default:          "",
				AutoGenerateFunc: "",
			},
			// workflow_id binds the webhook to a specific automation. Set
			// programmatically by runbook-server CreateWorkflowWebhookTrigger
			// when an automation attaches an existing webhook integration.
			// Hidden from the integration form. No Default — leaving it nil
			// keeps applySchemaDefaults from injecting an empty value that
			// would clobber the binding when the user edits the integration
			// from the Integrations tab.
			"workflow_id": {
				Type:        core.ToolSchemaTypeString,
				Description: "ID of the automation this webhook is bound to",
				Hidden:      true,
			},
			// workflow_mapping routes the same webhook URL to different
			// automations based on payload content. Stored as JSON:
			//
			//   {"rules":[{"match":{"alert_type":"deploy"},"workflowId":"<uuid>"},
			//             {"match":{"alert_type":["scale","restart"]},"workflowId":"<uuid>"}]}
			//
			// Match is AND across keys, OR within values. Rules evaluate
			// top-to-bottom; first match wins. When no rule matches, falls
			// back to the bound workflow_id.
			//
			// Rendered by the IntegrationDynamicFormModal as a "Workflow
			// Mapping" rules section, not by the generic schema renderer
			// (Hidden:true).
			"workflow_mapping": {
				Type:        core.ToolSchemaTypeString,
				Description: "Optional rules that route incoming webhooks to different automations based on payload labels",
				Hidden:      true,
			},
		},
	}
}

// workflowMappingRule is one rule of the workflow_mapping shape. Match is
// AND across keys (every entry must hit) and OR within values (any of the
// listed values matches that key). WorkflowId is the routing target when
// the rule matches; AccountId is the cloud account that workflow lives in
// (required when the integration is wired to multiple accounts so the
// downstream runbook-server lookup hits the correct (workflow, account)
// pair instead of 404-ing on a cross-account mismatch).
type workflowMappingRule struct {
	Match      map[string][]string
	WorkflowId string
	AccountId  string
}

// parseWorkflowMapping parses the workflow_mapping JSON value into a slice
// of rules. Tolerates both string and []string match values. Returns nil
// when the value is missing, empty, malformed, or contains no usable rules.
// Results are memoized in workflowMappingCache keyed by raw string so the
// hot path (one parse per webhook hit) reduces to a sync.Map lookup once
// the integration's mapping is stable.
func parseWorkflowMapping(raw string, logger *slog.Logger) []workflowMappingRule {
	if raw == "" {
		return nil
	}
	if cached, ok := workflowMappingCache.Load(raw); ok {
		return cached.([]workflowMappingRule)
	}
	rules := parseWorkflowMappingUncached(raw, logger)
	// Cache even empty/nil results — malformed JSON also stays stable per row.
	actual, _ := workflowMappingCache.LoadOrStore(raw, rules)
	return actual.([]workflowMappingRule)
}

func parseWorkflowMappingUncached(raw string, logger *slog.Logger) []workflowMappingRule {
	var top map[string]any
	if err := json.Unmarshal([]byte(raw), &top); err != nil {
		if logger != nil {
			logger.Error("workflow_webhook: failed to unmarshal workflow_mapping", "error", err)
		}
		return nil
	}
	if top == nil {
		return nil
	}
	rawRules, ok := top["rules"].([]any)
	if !ok {
		return nil
	}
	rules := make([]workflowMappingRule, 0, len(rawRules))
	for _, rawRule := range rawRules {
		ruleMap, ok := rawRule.(map[string]any)
		if !ok {
			continue
		}
		workflowId, _ := ruleMap["workflowId"].(string)
		accountId, _ := ruleMap["accountId"].(string)
		matchAny, ok := ruleMap["match"].(map[string]any)
		if !ok {
			continue
		}
		match := make(map[string][]string, len(matchAny))
		for k, v := range matchAny {
			switch val := v.(type) {
			case string:
				if val != "" {
					match[k] = []string{val}
				}
			case []any:
				list := make([]string, 0, len(val))
				for _, item := range val {
					if s, ok := item.(string); ok && s != "" {
						list = append(list, s)
					}
				}
				if len(list) > 0 {
					match[k] = list
				}
			}
		}
		if workflowId == "" || len(match) == 0 {
			continue
		}
		rules = append(rules, workflowMappingRule{Match: match, WorkflowId: workflowId, AccountId: accountId})
	}
	return rules
}

// resolveWorkflowFromMapping walks the rules top-to-bottom and returns the
// first rule's (WorkflowId, AccountId) whose Match keys all hit corresponding
// payload values (AND across keys, OR within each key's value list). Returns
// empty strings when no rule matches. AccountId may be empty when the rule
// was saved before per-rule accountId was added; callers should keep the
// integration's default account in that case.
func resolveWorkflowFromMapping(rules []workflowMappingRule, payload map[string]any) (string, string) {
	if len(rules) == 0 || len(payload) == 0 {
		return "", ""
	}
	for _, rule := range rules {
		if mappingRuleMatches(rule.Match, payload) {
			return rule.WorkflowId, rule.AccountId
		}
	}
	return "", ""
}

// mappingRuleMatches returns true when every key in match has a matching
// value in payload. Each payload scalar is normalized via a type switch
// (string, bool, float64, int) so JSON numbers like 200 don't become "200"
// with a Sprintf("%v", ...) round-trip that would also stringify floats as
// "1.5" and lose precision on large integers. Non-scalar values (objects,
// arrays, nulls) never match — users can only key off top-level scalars.
func mappingRuleMatches(match map[string][]string, payload map[string]any) bool {
	for k, allowed := range match {
		got, ok := payload[k]
		if !ok {
			return false
		}
		gotStr, isScalar := scalarToString(got)
		if !isScalar {
			return false
		}
		found := false
		for _, v := range allowed {
			if v == gotStr {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// scalarToString returns the canonical string form of a top-level JSON
// scalar so rule values written as text can match unambiguously. Bool
// becomes "true"/"false"; integers (encoded as float64 by encoding/json)
// drop the trailing ".0"; non-scalars return false to signal "won't match".
func scalarToString(v any) (string, bool) {
	switch t := v.(type) {
	case string:
		return t, true
	case bool:
		if t {
			return "true", true
		}
		return "false", true
	case float64:
		// JSON numbers always decode to float64; render integral values
		// without a decimal so "alert_count == 5" matches the payload {"alert_count":5}.
		if t == float64(int64(t)) {
			return fmt.Sprintf("%d", int64(t)), true
		}
		return fmt.Sprintf("%g", t), true
	case int:
		return fmt.Sprintf("%d", t), true
	case int64:
		return fmt.Sprintf("%d", t), true
	case json.Number:
		return t.String(), true
	default:
		return "", false
	}
}

func (m WorkflowWebhook) ValidateConfig(sc *security.SecurityContext, config []core.IntegrationConfigValue, accountId string) []error {
	// Validate workflow_mapping at save time so malformed rules surface in the
	// integration form rather than silently dropping at webhook time. Cheap
	// structural checks only — we don't cross-call runbook-server to confirm
	// each workflow_id exists, because the runbook lives in another service
	// and could be created/deleted independently after save.
	for _, c := range config {
		if c.Name != "workflow_mapping" || c.Value == "" {
			continue
		}
		errs := validateWorkflowMappingValue(c.Value)
		if len(errs) > 0 {
			return errs
		}
	}
	return []error{}
}

// validateWorkflowMappingValue parses the workflow_mapping JSON and surfaces
// structural problems: invalid JSON, top-level not an object, rules not an
// array, rule items missing workflowId/match, or workflowId/accountId not a
// valid UUID. Stops at the first malformed rule and returns a single error
// so the form can show one actionable message.
func validateWorkflowMappingValue(raw string) []error {
	var top map[string]any
	if err := json.Unmarshal([]byte(raw), &top); err != nil {
		return []error{fmt.Errorf("workflow_mapping: invalid JSON — %w", err)}
	}
	rawRules, ok := top["rules"].([]any)
	if !ok {
		return []error{errors.New("workflow_mapping: expected an object with a 'rules' array")}
	}
	for i, rawRule := range rawRules {
		ruleMap, ok := rawRule.(map[string]any)
		if !ok {
			return []error{fmt.Errorf("workflow_mapping: rule %d is not an object", i+1)}
		}
		workflowId, _ := ruleMap["workflowId"].(string)
		if workflowId == "" {
			return []error{fmt.Errorf("workflow_mapping: rule %d is missing workflowId", i+1)}
		}
		if _, err := uuid.Parse(workflowId); err != nil {
			return []error{fmt.Errorf("workflow_mapping: rule %d has an invalid workflowId (must be a UUID)", i+1)}
		}
		if accountId, present := ruleMap["accountId"].(string); present && accountId != "" {
			if _, err := uuid.Parse(accountId); err != nil {
				return []error{fmt.Errorf("workflow_mapping: rule %d has an invalid accountId (must be a UUID)", i+1)}
			}
		}
		matchAny, ok := ruleMap["match"].(map[string]any)
		if !ok || len(matchAny) == 0 {
			return []error{fmt.Errorf("workflow_mapping: rule %d is missing a non-empty 'match' object", i+1)}
		}
	}
	return nil
}

func (m WorkflowWebhook) ProcessEventWebook(sc *security.RequestContext, settings []core.IntegrationConfigValue, accountId, webhookPayloadString string) ([]core.EventIncomingWebhook, error) {
	workflowId, _ := core.GetSettingValue(settings, "workflow_id")
	token, _ := core.GetSettingValue(settings, "token")
	mappingRaw, _ := core.GetSettingValue(settings, "workflow_mapping")

	// workflow_mapping wins when a rule matches the payload; otherwise the
	// webhook routes to the bound workflow_id (1:1 fallback). Payload is
	// parsed into a top-level map of string-keyed values for matching;
	// non-JSON payloads silently skip mapping evaluation. When the rule
	// also carries an accountId, override the integration's default account
	// so the downstream runbook-server lookup hits the correct
	// (workflow, account) pair — otherwise cross-account mappings 404.
	if rules := parseWorkflowMapping(mappingRaw, sc.GetLogger()); len(rules) > 0 {
		var payloadMap map[string]any
		if err := json.Unmarshal([]byte(webhookPayloadString), &payloadMap); err == nil {
			if matchedWf, matchedAcc := resolveWorkflowFromMapping(rules, payloadMap); matchedWf != "" {
				workflowId = matchedWf
				if matchedAcc != "" {
					accountId = matchedAcc
				}
			}
		}
	}

	if workflowId == "" {
		sc.GetLogger().Error("generic_webhook: unable to process workflow", "workflow", workflowId, "payload", webhookPayloadString)
		return nil, errors.New("unable to identify workflow")
	}

	// Filter is now evaluated at the trigger level by runbook-server
	// (see runbook-server/api/handlers.go webhook handler) so the same
	// integration can fan out to multiple workflows in the future, each
	// with its own filter.
	resp, err := common.HttpPost(config.Config.WorkflowServerEndpoint+"/webhook/"+workflowId,
		common.HttpWithStringBody(webhookPayloadString),
		common.HttpWithHeaders(map[string]string{
			"X-Webhook-Secret": token,
			"x-tenant-id":      sc.GetSecurityContext().GetTenantId(),
			"x-account-id":     accountId,
		}),
	)
	if err != nil {
		sc.GetLogger().Error("generic_webhook: unable to process workflow", "workflow", workflowId, "payload", webhookPayloadString, "error", err)
		return nil, errors.New("unable to process workflow - " + workflowId)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Error("unable to close body", "error", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		sc.GetLogger().Error("generic_webhook: unable to read workflow trigger resp", "workflow", workflowId, "payload", webhookPayloadString, "error", err)
		return nil, err
	}

	triggerInfo := fmt.Sprintf(`{"status":%d, "body":"%s"}`, resp.StatusCode, string(body))

	webhookId := uuid.NewString()
	t := time.Now()
	return []core.EventIncomingWebhook{{
		WebhookId:             webhookId,
		EventType:             IntegrationGenericWebhook,
		EventUrl:              "",
		EventId:               webhookId,
		EventStatus:           "resolved",
		EventPriority:         "low",
		EventTitle:            "Webhook Event for workflow - " + workflowId,
		EventDescription:      triggerInfo,
		EventTags:             nil,
		EventSubjectName:      workflowId,
		EventSubjectNamespace: "Workflow",
		EventCreatedAt:        t,
		EventEndsAt:           t,
	}}, nil
}

func (m WorkflowWebhook) MergeEventWebhooks(sc *security.RequestContext, previous core.EventIncomingWebhook, new core.EventIncomingWebhook) (core.EventIncomingWebhook, error) {
	return new, nil
}
