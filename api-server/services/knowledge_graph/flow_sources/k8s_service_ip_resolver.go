package flow_sources

import (
	"nudgebee/services/knowledge_graph/core"
)

// K8sServiceIPResolver resolves a K8s Service ClusterIP to an existing Service node.
//
// ClusterIPs are unique within a single cluster, not across clusters. A tenant
// running multiple K8s clusters under the same cloud account routinely has the
// same IP (e.g. 10.0.0.1) bound to different Services in each cluster. The
// resolver therefore primarily indexes on (cluster, cluster_ip) and only falls
// back to a global IP lookup when the caller's cluster is unknown AND the IP is
// globally unique. When the IP is ambiguous globally and the caller cluster is
// unknown, the resolver refuses to guess.
type K8sServiceIPResolver struct {
	byClusterIP        map[clusterIPKey]*core.DbNode
	byIPAcrossClusters map[string][]*core.DbNode
}

type clusterIPKey struct {
	cluster string
	ip      string
}

// NewK8sServiceIPResolver builds the resolver from the existing graph nodes.
// Only K8s Service nodes are indexed. Headless services (cluster_ip = "None"
// or empty) are skipped.
func NewK8sServiceIPResolver(existingNodes []*core.DbNode) *K8sServiceIPResolver {
	byKey := make(map[clusterIPKey]*core.DbNode)
	byIP := make(map[string][]*core.DbNode)

	for _, n := range existingNodes {
		if n == nil || n.NodeType != core.NodeTypeK8sService {
			continue
		}
		ip := stringProp(n, "cluster_ip")
		if ip == "" || ip == "None" || ip == "0.0.0.0" {
			continue
		}
		cluster := stringProp(n, "cluster")
		if cluster != "" {
			byKey[clusterIPKey{cluster, ip}] = n
		}
		byIP[ip] = append(byIP[ip], n)
	}

	return &K8sServiceIPResolver{
		byClusterIP:        byKey,
		byIPAcrossClusters: byIP,
	}
}

// Resolve returns a Service node for the given IP, scoped to callerCluster.
//
// When callerCluster is non-empty, only a same-cluster Service can match. This
// prevents wrong-cluster edges in multi-cluster tenants.
//
// When callerCluster is empty (e.g., the caller is a non-K8s service like an
// EC2 host), the resolver returns the unique node iff exactly one Service has
// this IP across all clusters. Ambiguous lookups return (nil, false) — better
// to emit no edge than a wrong one.
func (r *K8sServiceIPResolver) Resolve(callerCluster, ip string) (*core.DbNode, bool) {
	if r == nil || ip == "" {
		return nil, false
	}
	if callerCluster != "" {
		n, ok := r.byClusterIP[clusterIPKey{callerCluster, ip}]
		return n, ok
	}
	candidates := r.byIPAcrossClusters[ip]
	if len(candidates) == 1 {
		return candidates[0], true
	}
	return nil, false
}

// stringProp reads a string property from a node, tolerating missing or
// non-string values.
func stringProp(n *core.DbNode, key string) string {
	if n == nil || n.Properties == nil {
		return ""
	}
	if v, ok := n.Properties[key].(string); ok {
		return v
	}
	return ""
}
