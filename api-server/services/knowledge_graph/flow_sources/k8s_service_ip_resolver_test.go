package flow_sources

import (
	"nudgebee/services/knowledge_graph/core"
	"testing"
)

func makeServiceNode(name, cluster, ip string) *core.DbNode {
	return &core.DbNode{
		NodeType: core.NodeTypeK8sService,
		Properties: map[string]interface{}{
			"name":       name,
			"cluster":    cluster,
			"cluster_ip": ip,
		},
	}
}

func TestK8sServiceIPResolver_SameClusterHit(t *testing.T) {
	nodes := []*core.DbNode{
		makeServiceNode("loki-gateway", "prod-us-east", "10.0.0.10"),
		makeServiceNode("redis", "prod-us-east", "10.0.0.11"),
	}
	r := NewK8sServiceIPResolver(nodes)

	got, ok := r.Resolve("prod-us-east", "10.0.0.10")
	if !ok {
		t.Fatalf("expected hit for same-cluster IP")
	}
	if got.Properties["name"] != "loki-gateway" {
		t.Errorf("expected loki-gateway, got %v", got.Properties["name"])
	}
}

func TestK8sServiceIPResolver_MultiClusterDisambiguates(t *testing.T) {
	// Same IP exists in two clusters — common in multi-cluster tenants.
	nodes := []*core.DbNode{
		makeServiceNode("svc-a", "cluster-a", "10.0.0.1"),
		makeServiceNode("svc-b", "cluster-b", "10.0.0.1"),
	}
	r := NewK8sServiceIPResolver(nodes)

	gotA, okA := r.Resolve("cluster-a", "10.0.0.1")
	if !okA || gotA.Properties["name"] != "svc-a" {
		t.Errorf("caller in cluster-a should resolve to svc-a, got %v ok=%v", gotA, okA)
	}

	gotB, okB := r.Resolve("cluster-b", "10.0.0.1")
	if !okB || gotB.Properties["name"] != "svc-b" {
		t.Errorf("caller in cluster-b should resolve to svc-b, got %v ok=%v", gotB, okB)
	}
}

func TestK8sServiceIPResolver_AmbiguousIPWithoutCallerCluster(t *testing.T) {
	// Same IP in two clusters; caller has no cluster context (non-K8s caller).
	// Resolver must refuse to guess — wrong-edge is worse than no-edge.
	nodes := []*core.DbNode{
		makeServiceNode("svc-a", "cluster-a", "10.0.0.1"),
		makeServiceNode("svc-b", "cluster-b", "10.0.0.1"),
	}
	r := NewK8sServiceIPResolver(nodes)

	if _, ok := r.Resolve("", "10.0.0.1"); ok {
		t.Errorf("ambiguous IP without caller cluster should return false")
	}
}

func TestK8sServiceIPResolver_UniqueIPWithoutCallerClusterHits(t *testing.T) {
	// One Service globally with this IP — safe to resolve even without caller cluster.
	nodes := []*core.DbNode{
		makeServiceNode("only-svc", "cluster-a", "10.0.0.99"),
	}
	r := NewK8sServiceIPResolver(nodes)

	got, ok := r.Resolve("", "10.0.0.99")
	if !ok || got.Properties["name"] != "only-svc" {
		t.Errorf("unique global IP should resolve, got %v ok=%v", got, ok)
	}
}

func TestK8sServiceIPResolver_HeadlessServiceSkipped(t *testing.T) {
	nodes := []*core.DbNode{
		makeServiceNode("headless", "cluster-a", "None"),
		makeServiceNode("empty-ip", "cluster-a", ""),
		makeServiceNode("zero-ip", "cluster-a", "0.0.0.0"),
		makeServiceNode("real", "cluster-a", "10.0.0.5"),
	}
	r := NewK8sServiceIPResolver(nodes)

	if _, ok := r.Resolve("cluster-a", "None"); ok {
		t.Errorf(`"None" should not be resolvable`)
	}
	if _, ok := r.Resolve("cluster-a", ""); ok {
		t.Errorf("empty IP should not be resolvable")
	}
	if _, ok := r.Resolve("cluster-a", "0.0.0.0"); ok {
		t.Errorf("0.0.0.0 should not be resolvable")
	}
	got, ok := r.Resolve("cluster-a", "10.0.0.5")
	if !ok || got.Properties["name"] != "real" {
		t.Errorf("real IP should resolve, got %v ok=%v", got, ok)
	}
}

func TestK8sServiceIPResolver_NonK8sNodesIgnored(t *testing.T) {
	// Pollute the input with non-K8sService nodes; resolver should ignore them.
	nodes := []*core.DbNode{
		{NodeType: core.NodeTypeDatabase, Properties: map[string]interface{}{
			"name":       "rds-pg",
			"cluster_ip": "10.0.0.10",
			"cluster":    "prod",
		}},
		{NodeType: core.NodeTypePod, Properties: map[string]interface{}{
			"name":       "some-pod",
			"cluster_ip": "10.0.0.11",
			"cluster":    "prod",
		}},
		makeServiceNode("real", "prod", "10.0.0.10"),
	}
	r := NewK8sServiceIPResolver(nodes)

	got, ok := r.Resolve("prod", "10.0.0.10")
	if !ok || got.Properties["name"] != "real" {
		t.Errorf("expected K8s Service hit, got %v ok=%v", got, ok)
	}
}

func TestK8sServiceIPResolver_ServiceWithoutClusterFallsBackToGlobalIndex(t *testing.T) {
	// A K8s Service node lacking the "cluster" property still gets indexed in
	// byIPAcrossClusters so it remains resolvable when the caller has no cluster.
	nodes := []*core.DbNode{
		{NodeType: core.NodeTypeK8sService, Properties: map[string]interface{}{
			"name":       "no-cluster-svc",
			"cluster_ip": "172.16.0.1",
			// no "cluster" key
		}},
	}
	r := NewK8sServiceIPResolver(nodes)

	got, ok := r.Resolve("", "172.16.0.1")
	if !ok || got.Properties["name"] != "no-cluster-svc" {
		t.Errorf("unique-IP global lookup should succeed, got %v ok=%v", got, ok)
	}
}

func TestK8sServiceIPResolver_NilSafety(t *testing.T) {
	r := NewK8sServiceIPResolver(nil)
	if _, ok := r.Resolve("any", "1.2.3.4"); ok {
		t.Errorf("empty resolver should return false")
	}

	var nilResolver *K8sServiceIPResolver
	if _, ok := nilResolver.Resolve("any", "1.2.3.4"); ok {
		t.Errorf("nil resolver should return false")
	}

	// Nil node in input shouldn't panic.
	r2 := NewK8sServiceIPResolver([]*core.DbNode{nil, makeServiceNode("ok", "c", "10.0.0.1")})
	if _, ok := r2.Resolve("c", "10.0.0.1"); !ok {
		t.Errorf("expected hit after skipping nil")
	}
}
