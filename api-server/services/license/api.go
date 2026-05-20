package license

import (
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"nudgebee/services/internal/database"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes wires the /v1/license/me + /v1/license/bootstrap-check
// endpoints. Always available; OSS deployments report tier=oss with no
// features. The frontend reads from these instead of parsing the JWT locally.
func RegisterRoutes(r *gin.Engine) {
	r.GET("/v1/license/me", func(c *gin.Context) {
		lic := Get()
		var expiry int64
		if !lic.Expiry().IsZero() {
			expiry = lic.Expiry().Unix()
		}
		c.JSON(http.StatusOK, gin.H{
			"tier":        string(lic.Tier()),
			"status":      string(lic.Status()),
			"features":    lic.AllFeatures(),
			"expiry":      expiry,
			"tenant_id":   lic.TenantID(),
			"email":       lic.Email(),
			"server_time": time.Now().Unix(),
		})
	})

	// bootstrap-check is consulted by NextAuth's Credentials authorize()
	// callback before creating the first admin user. It centralizes the
	// "is this email allowed to bootstrap on this deployment" rule so the
	// frontend doesn't replicate license email-match logic.
	r.GET("/v1/license/bootstrap-check", func(c *gin.Context) {
		email := strings.TrimSpace(c.Query("email"))
		lic := Get()

		// OSS is single-tenant by design — there is no multi-tenant flow
		// in this build. Resolve any existing tenant so subsequent sign-ins
		// join the first user's tenant instead of creating a parallel one.
		// First sign-in returns empty tenant_id; the app's bootstrap path
		// then calls OnboardUser without a tenant_id, which auto-creates one
		// (user/service.go:1212). Race window between two concurrent first
		// sign-ins is small enough to ignore at OSS scale.
		if lic.Tier() == TierOSS {
			var existingTenantID string
			if dbm, dbErr := database.GetDatabaseManager(database.Metastore); dbErr == nil {
				err := dbm.Db.QueryRow("SELECT id::text FROM tenant ORDER BY created_at LIMIT 1").Scan(&existingTenantID)
				if err != nil && !errors.Is(err, sql.ErrNoRows) {
					// Don't fail sign-in — log and fall through to "no tenant"
					// behavior, which is correct for first sign-in anyway.
					slog.Error("OSS bootstrap-check: tenant lookup failed", "error", err)
				}
			}
			c.JSON(http.StatusOK, gin.H{
				"allowed":   true,
				"tenant_id": existingTenantID,
				"role":      "tenant_admin",
			})
			return
		}

		// EE: if the license carries an email, the typed username must match.
		// Empty license email means no allowlist (any email may bootstrap).
		if lic.Email() != "" && !strings.EqualFold(lic.Email(), email) {
			c.JSON(http.StatusOK, gin.H{
				"allowed":   false,
				"tenant_id": lic.TenantID(),
				"role":      "",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"allowed":   true,
			"tenant_id": lic.TenantID(),
			"role":      "tenant_admin",
		})
	})
}
