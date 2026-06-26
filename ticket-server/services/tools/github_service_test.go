package tools

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"nudgebee/tickets-server/models"

	"github.com/gin-gonic/gin"
	"github.com/google/go-github/v67/github"
)

// newTestGithubClient wires a github.Client to a local httptest server so we
// can drive both the issues/assignees lookup and the issue-create endpoint
// against canned responses.
func newTestGithubClient(t *testing.T, handler http.Handler) (*github.Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	baseURL, err := url.Parse(srv.URL + "/")
	if err != nil {
		srv.Close()
		t.Fatalf("parse test server URL: %v", err)
	}
	client := github.NewClient(nil)
	client.BaseURL = baseURL
	client.UploadURL = baseURL
	return client, srv
}

// TestCreateGithubIssueWithClient_RejectsInvalidAssignee verifies that we
// surface a clear error (with the list of valid assignees) when the LLM/UI
// passes an assignee that isn't a collaborator on the repo, instead of
// letting GitHub silently drop the field and reporting a phantom assignment.
func TestCreateGithubIssueWithClient_RejectsInvalidAssignee(t *testing.T) {
	const owner, repo = "nudgebee", "demo"
	var createCalled bool

	handler := http.NewServeMux()
	// IsAssignee for the invalid user → 404
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/assignees/ghost", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	// ListAssignees returns two valid users for the error message
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/assignees", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"login":"alice","id":1},{"login":"bob","id":2}]`))
	})
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/issues", func(_ http.ResponseWriter, _ *http.Request) {
		createCalled = true
	})

	client, srv := newTestGithubClient(t, handler)
	defer srv.Close()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ticket := models.Ticket{
		Title:      "boom",
		ProjectKey: owner + "/" + repo,
		Assignee:   "ghost",
		Source:     "ui",
	}

	_, err := createGithubIssueWithClient(ctx, client, ticket)
	if err == nil {
		t.Fatal("expected error for invalid assignee, got nil")
	}
	if !strings.Contains(err.Error(), "ghost") {
		t.Errorf("error should name the invalid assignee, got: %v", err)
	}
	if !strings.Contains(err.Error(), "alice") || !strings.Contains(err.Error(), "bob") {
		t.Errorf("error should list valid assignees (alice, bob), got: %v", err)
	}
	if createCalled {
		t.Error("issue should not be created when assignee validation fails")
	}
}

// TestCreateGithubIssueWithClient_OmitsEmptyAssignee ensures that when no
// assignee is requested we don't serialize an empty-string Assignee field
// (which GitHub would reject) and skip the validation API call entirely.
func TestCreateGithubIssueWithClient_OmitsEmptyAssignee(t *testing.T) {
	const owner, repo = "nudgebee", "demo"
	var capturedAssigneeKey bool
	var assigneeCheckCalled bool

	handler := http.NewServeMux()
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/assignees/", func(_ http.ResponseWriter, _ *http.Request) {
		assigneeCheckCalled = true
	})
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/issues", func(w http.ResponseWriter, r *http.Request) {
		// Inspect the JSON body for an "assignee" key
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode create body: %v", err)
		}
		_, capturedAssigneeKey = body["assignee"]
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"number":7,"html_url":"https://github.com/nudgebee/demo/issues/7"}`))
	})

	client, srv := newTestGithubClient(t, handler)
	defer srv.Close()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ticket := models.Ticket{
		Title:      "no assignee",
		ProjectKey: owner + "/" + repo,
		Source:     "ui",
	}

	got, err := createGithubIssueWithClient(ctx, client, ticket)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.TicketID != "7" {
		t.Errorf("expected ticket_id=7, got %q", got.TicketID)
	}
	if assigneeCheckCalled {
		t.Error("IsAssignee should not be called when no assignee is requested")
	}
	if capturedAssigneeKey {
		t.Error("issue body should not contain an assignee key when none is requested")
	}
}

// TestCreateGithubIssueWithClient_AcceptsValidAssignee verifies the happy
// path: a valid assignee passes validation, gets included in the create
// request, and the issue is created.
func TestCreateGithubIssueWithClient_AcceptsValidAssignee(t *testing.T) {
	const owner, repo = "nudgebee", "demo"
	var sentAssignee string

	handler := http.NewServeMux()
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/assignees/alice", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/issues", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Assignee string `json:"assignee"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode create body: %v", err)
		}
		sentAssignee = body.Assignee
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"number":42,"html_url":"https://github.com/nudgebee/demo/issues/42"}`))
	})

	client, srv := newTestGithubClient(t, handler)
	defer srv.Close()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ticket := models.Ticket{
		Title:      "real bug",
		ProjectKey: owner + "/" + repo,
		Assignee:   "alice",
		Source:     "ui",
	}

	got, err := createGithubIssueWithClient(ctx, client, ticket)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sentAssignee != "alice" {
		t.Errorf("expected assignee=alice sent to GitHub, got %q", sentAssignee)
	}
	if got.TicketID != "42" {
		t.Errorf("expected ticket_id=42, got %q", got.TicketID)
	}
	if got.Status != "open" {
		t.Errorf("expected status=open, got %q", got.Status)
	}
}

// TestGetGithubIssueWithClient_MapsMetadata verifies that the Get mapping
// promotes assignees, labels, reporter, milestone, project_key and updated_at
// to top-level Ticket fields (issue #32155), not just into Raw.
func TestGetGithubIssueWithClient_MapsMetadata(t *testing.T) {
	const owner, repo = "nudgebee", "demo"

	handler := http.NewServeMux()
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/issues/42", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"number": 42,
			"title": "Issue Title",
			"body": "Issue Description",
			"state": "open",
			"html_url": "https://github.com/nudgebee/demo/issues/42",
			"created_at": "2026-06-11T06:18:55Z",
			"updated_at": "2026-06-11T06:19:05Z",
			"user": {"login": "rohitutekar123"},
			"assignee": {"login": "rohitutekar123"},
			"assignees": [{"login": "Kankshit-02"}, {"login": "rohitutekar123"}],
			"labels": [{"name": "bug"}, {"name": "Workflow"}],
			"milestone": {"title": "v1.0"}
		}`))
	})

	client, srv := newTestGithubClient(t, handler)
	defer srv.Close()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	got, err := getGithubIssueWithClient(ctx, client, owner, repo, 42, owner+"/"+repo)
	if err != nil {
		t.Fatalf("getGithubIssueWithClient() error = %v", err)
	}

	if got.Assignee != "rohitutekar123" {
		t.Errorf("Assignee = %q, want rohitutekar123", got.Assignee)
	}
	if joined := strings.Join(got.Assignees, ","); joined != "Kankshit-02,rohitutekar123" {
		t.Errorf("Assignees = %v, want [Kankshit-02 rohitutekar123]", got.Assignees)
	}
	if got.Reporter != "rohitutekar123" {
		t.Errorf("Reporter = %q, want rohitutekar123", got.Reporter)
	}
	if joined := strings.Join(got.Labels, ","); joined != "bug,Workflow" {
		t.Errorf("Labels = %v, want [bug Workflow]", got.Labels)
	}
	if got.Milestone != "v1.0" {
		t.Errorf("Milestone = %q, want v1.0", got.Milestone)
	}
	if got.ProjectKey != owner+"/"+repo {
		t.Errorf("ProjectKey = %q, want %s/%s", got.ProjectKey, owner, repo)
	}
	if got.URL != "https://github.com/nudgebee/demo/issues/42" {
		t.Errorf("URL = %q", got.URL)
	}
	if got.CreatedAt == nil || got.CreatedAt.UTC().Format(time.RFC3339) != "2026-06-11T06:18:55Z" {
		t.Errorf("CreatedAt = %v, want 2026-06-11T06:18:55Z", got.CreatedAt)
	}
	if got.UpdatedAt == nil || got.UpdatedAt.UTC().Format(time.RFC3339) != "2026-06-11T06:19:05Z" {
		t.Errorf("UpdatedAt = %v, want 2026-06-11T06:19:05Z", got.UpdatedAt)
	}
	if got.Platform != "github" {
		t.Errorf("Platform = %q, want github", got.Platform)
	}
}

func TestUpdateGitHubIssueWithClient_ClosedUsesIssueState(t *testing.T) {
	const owner, repo = "nudgebee", "demo"
	var sentState string
	var graphQLCalled bool

	handler := http.NewServeMux()
	handler.HandleFunc("/repos/"+owner+"/"+repo+"/issues/42", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Fatalf("method = %s, want PATCH", r.Method)
		}
		var body struct {
			State string `json:"state"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode update body: %v", err)
		}
		sentState = body.State
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"number":42,"state":"closed"}`))
	})

	client, srv := newTestGithubClient(t, handler)
	defer srv.Close()

	graphQLSrv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		graphQLCalled = true
	}))
	defer graphQLSrv.Close()
	oldEndpoint := githubGraphQLEndpoint
	oldHTTPClient := githubGraphQLHTTPClient
	githubGraphQLEndpoint = graphQLSrv.URL
	githubGraphQLHTTPClient = graphQLSrv.Client()
	defer func() {
		githubGraphQLEndpoint = oldEndpoint
		githubGraphQLHTTPClient = oldHTTPClient
	}()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	err := updateGitHubIssueWithClient(ctx, client, "token", owner, repo, "42", models.UpdateFields{Status: "closed"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sentState != "closed" {
		t.Fatalf("state = %q, want closed", sentState)
	}
	if graphQLCalled {
		t.Fatal("GraphQL should not be called for issue-level open/closed transitions")
	}
}

func TestUpdateGitHubIssueWithClient_ProjectStatusUsesGraphQL(t *testing.T) {
	const owner, repo = "nudgebee", "demo"
	var restEditCalled bool
	var mutationOptionID string

	restHandler := http.NewServeMux()
	restHandler.HandleFunc("/repos/"+owner+"/"+repo+"/issues/42", func(http.ResponseWriter, *http.Request) {
		restEditCalled = true
	})
	client, restSrv := newTestGithubClient(t, restHandler)
	defer restSrv.Close()

	graphQLSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Query     string         `json:"query"`
			Variables map[string]any `json:"variables"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode graphql body: %v", err)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer token" {
			t.Fatalf("Authorization = %q, want Bearer token", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(body.Query, "projectItems") {
			_, _ = w.Write([]byte(`{
				"data": {
					"repository": {
						"issue": {
							"projectItems": {
								"nodes": [{
									"id": "item-1",
									"project": {
										"id": "project-1",
										"title": "Delivery",
										"fields": {
											"nodes": [{
												"id": "field-status",
												"name": "Status",
												"options": [
													{"id": "opt-ready", "name": "Ready"},
													{"id": "opt-qa", "name": "QA"}
												]
											}]
										}
									}
								}]
							}
						}
					}
				}
			}`))
			return
		}
		if strings.Contains(body.Query, "updateProjectV2ItemFieldValue") {
			mutationOptionID, _ = body.Variables["optionId"].(string)
			if body.Variables["projectId"] != "project-1" || body.Variables["itemId"] != "item-1" || body.Variables["fieldId"] != "field-status" {
				t.Fatalf("unexpected mutation variables: %#v", body.Variables)
			}
			_, _ = w.Write([]byte(`{"data":{"updateProjectV2ItemFieldValue":{"projectV2Item":{"id":"item-1"}}}}`))
			return
		}
		t.Fatalf("unexpected GraphQL query: %s", body.Query)
	}))
	defer graphQLSrv.Close()

	oldEndpoint := githubGraphQLEndpoint
	oldHTTPClient := githubGraphQLHTTPClient
	githubGraphQLEndpoint = graphQLSrv.URL
	githubGraphQLHTTPClient = graphQLSrv.Client()
	defer func() {
		githubGraphQLEndpoint = oldEndpoint
		githubGraphQLHTTPClient = oldHTTPClient
	}()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	err := updateGitHubIssueWithClient(ctx, client, "token", owner, repo, "42", models.UpdateFields{Status: "Ready"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if restEditCalled {
		t.Fatal("REST issue edit should not be called for project-only status transitions")
	}
	if mutationOptionID != "opt-ready" {
		t.Fatalf("optionId = %q, want opt-ready", mutationOptionID)
	}
}

func TestGitHubStatusAllowedValuesIncludesProjectStatuses(t *testing.T) {
	graphQLSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode graphql body: %v", err)
		}
		if !strings.Contains(body.Query, "projectsV2") {
			t.Fatalf("expected projectsV2 query, got %s", body.Query)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"repository": {
					"projectsV2": {
						"nodes": [{
							"id": "project-1",
							"title": "Delivery",
							"fields": {
								"nodes": [{
									"id": "field-status",
									"name": "Status",
									"options": [
										{"id": "opt-ready", "name": "Ready"},
										{"id": "opt-progress", "name": "In Progress"}
									]
								}]
							}
						}]
					}
				}
			}
		}`))
	}))
	defer graphQLSrv.Close()

	oldEndpoint := githubGraphQLEndpoint
	oldHTTPClient := githubGraphQLHTTPClient
	githubGraphQLEndpoint = graphQLSrv.URL
	githubGraphQLHTTPClient = graphQLSrv.Client()
	defer func() {
		githubGraphQLEndpoint = oldEndpoint
		githubGraphQLHTTPClient = oldHTTPClient
	}()

	values := githubStatusAllowedValues(httptest.NewRequest(http.MethodPost, "/", nil).Context(), "token", "nudgebee", "demo")
	got := map[string]bool{}
	for _, value := range values {
		row, ok := value.(map[string]interface{})
		if !ok {
			t.Fatalf("unexpected value type %T", value)
		}
		got[row["value"].(string)] = true
	}

	for _, want := range []string{"open", "closed", "Ready", "In Progress"} {
		if !got[want] {
			t.Fatalf("status %q missing from allowed values %#v", want, values)
		}
	}
}
