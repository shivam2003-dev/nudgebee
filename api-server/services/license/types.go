package license

import "time"

// Status reflects the current license verification state. Consumers gate
// destructive UX (banners, etc.) on this.
type Status string

const (
	StatusActive  Status = "active"
	StatusGrace   Status = "grace"
	StatusExpired Status = "expired"
	StatusMissing Status = "missing"
)

// Tier identifies the deployment shape. Build-time, the OSS binary always
// returns TierOSS. Runtime, the EE binary returns the lesser of the
// operator-requested NUDGEBEE_DEPLOYMENT_MODE and the license-authorized tier.
type Tier string

const (
	TierOSS  Tier = "oss"
	TierEE   Tier = "ee"
	TierSaaS Tier = "saas"
)

// License is the runtime authority for tier and feature gating. All
// feature gates in product code consult HasFeature; tier is a coarse UX
// label. OSS impl returns TierOSS, no features, no tenant/email.
type License interface {
	Tier() Tier
	Status() Status
	HasFeature(feature string) bool
	AllFeatures() []string
	TenantID() string
	Email() string
	Expiry() time.Time
	MaxAccounts() int
	MaxNodesPerCluster() int
}
