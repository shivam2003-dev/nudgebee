package flow_sources

import (
	"testing"
)

func TestLooksLikeK8sServiceNameTLDSuffix(t *testing.T) {
	parser := NewK8sDNSParser()

	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		// Valid service.namespace names that merely contain a TLD substring
		// must not be rejected (regression for #139).
		{name: "namespace ending in 'coordinator' contains .co", input: "payments.coordinator", expected: true},
		{name: "namespace ending in 'networking' contains .net", input: "svc.networking", expected: true},

		// Genuine external hostnames ending in a TLD are still rejected.
		{name: "external .com is rejected", input: "api.example.com", expected: false},
		{name: "external .net is rejected", input: "cdn.example.net", expected: false},
		{name: "external .co is rejected", input: "service.example.co", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parser.LooksLikeK8sServiceName(tt.input)
			if got != tt.expected {
				t.Errorf("LooksLikeK8sServiceName(%q) = %v, expected %v", tt.input, got, tt.expected)
			}
		})
	}
}
