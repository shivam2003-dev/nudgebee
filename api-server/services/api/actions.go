package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"nudgebee/services/common"
	"nudgebee/services/license"
	"nudgebee/services/query"
	"nudgebee/services/security"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

type ActionRequestAction struct {
	Name string `json:"name"`
}

type ActionRequestQuery struct {
	Query query.QueryRequest `json:"query"`
}

type ActionRequest struct {
	Action           ActionRequestAction `json:"action"`
	Input            map[string]any            `json:"input"`
	RequestQuery     string                    `json:"request_query"`
	SessionVariables map[string]any            `json:"session_variables"`
}

func buildContextFromPayload(c *gin.Context, h *ActionRequest, tracer *trace.Tracer, meter *metric.Meter, logger *slog.Logger) (*security.RequestContext, error) {
	var ctx context.Context
	if c != nil && c.Request != nil && c.Request.Context() != nil {
		ctx = c.Request.Context()
	} else {
		ctx = context.Background()
	}

	// no need to handle role as its calculated by security context
	tenantId := ""
	userId := ""
	if c != nil && c.Request != nil {
		tenantId = c.Request.Header.Get("x-tenant-id")
		userId = c.Request.Header.Get("x-user-id")
	}

	if tenantId == "" && h.SessionVariables["x-hasura-user-tenant-id"] != nil {
		tenantId = h.SessionVariables["x-hasura-user-tenant-id"].(string)
	}

	if userId == "" && h.SessionVariables["x-hasura-user-id"] != nil {
		userId = h.SessionVariables["x-hasura-user-id"].(string)
	}

	var securityContext *security.SecurityContext
	var err error
	if h.SessionVariables["x-hasura-role"] == "admin" && tenantId == "" && userId == "" {
		securityContext = security.NewSecurityContextForSuperAdmin()
	} else if tenantId != "" && userId == "" {
		securityContext = security.NewSecurityContextForSuperAdminAndTenant(tenantId)
	} else {
		securityContext, err = security.NewSecurityContext(tenantId, userId)
		if err != nil {
			logger.Error("error creating security context", "error", err)
			return nil, err
		}
	}

	// If x-hasura-allowed-roles contains exact super_admin role, mark context as super admin
	allowedRoles, _ := h.SessionVariables["x-hasura-allowed-roles"].(string)
	for _, role := range strings.Split(strings.Trim(allowedRoles, "{}"), ",") {
		if strings.TrimSpace(role) == security.AUTH_SUPER_ADMIN_FULL_ROLE {
			securityContext.AddRole(security.AUTH_SUPER_ADMIN_FULL_ROLE)
			break
		}
	}

	span := trace.SpanFromContext(ctx)
	childLogger := logger.With("tenant_id", tenantId, "user_id", userId, "trace_id", span.SpanContext().TraceID().String())
	return security.NewRequestContext(ctx, securityContext, childLogger, tracer, meter), nil
}

func handleApis(r *gin.Engine, tracer *trace.Tracer, meter *metric.Meter, logger *slog.Logger) {
	groupV2 := r.Group("/hasura")

	groupV2.POST("/ml", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "ml")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "ml", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleMlAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/query", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "query")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "query", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest("invalid json - "+err.Error()))
			return
		}

		handleQueryAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/promql/parser", func(ctx *gin.Context) {
		common.MetricsApiRequestsTotal(ctx.Request.Context(), "promql_parser")
		var actionPayload ActionRequest
		err := ctx.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(ctx.Request.Context(), "promql_parser", "invalid_json")
			ctx.JSON(400, common.ErrorActionBadRequest("invalid json - "+err.Error()))
			return
		}
		handlePromQL(&actionPayload, ctx, tracer, meter, logger)
	})

	groupV2.POST("/recommendation", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "recommendation")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "recommendation", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		handleRecommendationAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/account", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "account")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "account", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		handleAccountAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/tenant", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "tenant")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "tenant", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		handleTenantAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/user", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "user")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "user", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		handleUserAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/nb", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "nb")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleNbAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/cloud", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "cloud")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "cloud", "invalid_json")
			c.JSON(400, []common.Error{
				{
					Message: err.Error(),
				},
			})
			return
		}
		handleCloudAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/eventrule", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "eventrule")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "eventrule", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleEventRuleAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/slo", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "slo")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "slo", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleSloAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/event", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "event")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "event", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleEventAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/pr-raise", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "pr_raise")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handlePRRaiseAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/application", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "application")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleApplicationEvent(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/ai", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "ai")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleAiFeedbackAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/insights", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "insights")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleInsights(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/integration", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "integration")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleIntegrationAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/anomaly", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "anomaly")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleAnomaly(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/license", func(c *gin.Context) {
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		license.CheckLimits(c, tracer, meter, logger)
	})

	groupV2.POST("/logs", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "logs")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleLogsAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/metrics", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "metrics")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleMetricsAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/cluster-health", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "nb")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleClusterHealthAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/k8s-upgrade", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "nb")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleUpgradePlanAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/provider", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "provider")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleAccountProviderAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/traces", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "traces")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleTracesAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/user-history", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "user-history")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "nb", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleAccountUserHistoryAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/knowledge-graph", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "knowledge_graph")

		// Read raw body to allow parsing as either request type
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "knowledge_graph", "read_body_error")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		var actionPayload ActionRequest
		if err := json.Unmarshal(bodyBytes, &actionPayload); err != nil {
			common.MetricsApiRequestsFailedTotal(c.Request.Context(), "knowledge_graph", "invalid_json")
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}

		// If action name is blank, try parsing as CronRequest
		if actionPayload.Action.Name == "" {
			var cronPayload CronRequest
			if err := json.Unmarshal(bodyBytes, &cronPayload); err == nil && cronPayload.Name != "" {
				actionPayload.Action.Name = cronPayload.Name
				actionPayload.Input = cronPayload.Payload
			}
		}

		handleKnowledgeGraphAction(&actionPayload, c, tracer, meter, logger)
	})

	groupV2.POST("/logs-group", func(c *gin.Context) {
		common.MetricsApiRequestsTotal(c.Request.Context(), "logs-group")
		var actionPayload ActionRequest
		err := c.ShouldBindJSON(&actionPayload)
		if err != nil {
			c.JSON(400, common.ErrorActionBadRequest(err.Error()))
			return
		}
		handleLogsAction(&actionPayload, c, tracer, meter, logger)
	})
}
