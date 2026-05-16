package flow_sources

import (
	"nudgebee/services/knowledge_graph/core"
	"testing"
)

// TestAWSClassifier_ClassifyHostname covers the hostname-pattern → NodeType
// table at flow_sources/enrichment_aws_classifier.go:classifyByPattern. The
// table has historically lost entries for new AWS form variants (e.g. the
// account-scoped DDB SDK form, ECR Public) — pinning each form here flags
// regressions when the pattern list is reordered or trimmed.
func TestAWSClassifier_ClassifyHostname(t *testing.T) {
	c := NewAWSClassifier()

	cases := []struct {
		name        string
		hostname    string
		wantType    core.NodeType
		wantService string
	}{
		// Pre-existing patterns — protect against regression in this PR.
		{"elb_alb", "my-alb-1234.us-east-1.elb.amazonaws.com", core.NodeTypeLoadBalancer, "elb"},
		{"rds", "mydb.abc.us-east-1.rds.amazonaws.com", core.NodeTypeDatabase, "rds"},
		{"s3_virtual_regional", "nudgebee-emails.s3.us-east-1.amazonaws.com", core.NodeTypeStorage, "s3"},
		{"sqs_regional", "sqs.us-east-1.amazonaws.com", core.NodeTypeMessageQueue, "sqs"},
		{"sns_regional", "sns.us-east-1.amazonaws.com", core.NodeTypeMessageQueue, "sns"},
		{"dynamodb_service_endpoint", "dynamodb.us-east-1.amazonaws.com", core.NodeTypeDatabase, "dynamodb"},
		{"lambda_service_endpoint", "lambda.us-east-1.amazonaws.com", core.NodeTypeServerlessFunction, "lambda"},

		// New patterns added in this PR.
		{
			name:        "dynamodb_account_scoped_sdk_form",
			hostname:    "331803013664.ddb.us-east-1.amazonaws.com",
			wantType:    core.NodeTypeDatabase,
			wantService: "dynamodb",
		},
		{
			name:        "ecr_public_api_endpoint",
			hostname:    "api.ecr-public.us-east-1.amazonaws.com",
			wantType:    core.NodeTypeContainerRegistry,
			wantService: "ecr-public",
		},
		{
			name:        "ecr_public_global_host",
			hostname:    "public.ecr.aws",
			wantType:    core.NodeTypeContainerRegistry,
			wantService: "ecr-public",
		},

		// Regression guard: ECR Public must classify before private ECR
		// (since `.ecr-public.` contains `.ecr.` substring).
		{
			name:        "ecr_private_unaffected",
			hostname:    "740395098545.dkr.ecr.us-east-1.amazonaws.com",
			wantType:    core.NodeTypeContainerRegistry,
			wantService: "ecr",
		},

		// Non-AWS host returns "" for both.
		{"non_aws", "example.com", "", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotType, gotService := c.ClassifyHostname(tc.hostname)
			if gotType != tc.wantType {
				t.Errorf("type = %q, want %q", gotType, tc.wantType)
			}
			if gotService != tc.wantService {
				t.Errorf("service = %q, want %q", gotService, tc.wantService)
			}
		})
	}
}
