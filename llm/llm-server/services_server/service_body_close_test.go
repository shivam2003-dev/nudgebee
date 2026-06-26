package services_server

import (
	"fmt"
	"io"
	"net/http"
	"nudgebee/llm/common"
	"nudgebee/llm/config"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type trackingReadCloser struct {
	*strings.Reader
	closed bool
}

func (b *trackingReadCloser) Close() error {
	b.closed = true
	return nil
}

func TestServiceServerErrorResponsesCloseBody(t *testing.T) {
	oldTransport := common.HttpClient().Transport
	oldEndpoint := config.Config.ServiceEndpoint
	t.Cleanup(func() {
		common.HttpClient().Transport = oldTransport
		config.Config.ServiceEndpoint = oldEndpoint
	})

	config.Config.ServiceEndpoint = "http://services-server.test"

	tests := []struct {
		name       string
		statusCode int
		call       func() error
	}{
		{
			name:       "execute_query_401",
			statusCode: http.StatusUnauthorized,
			call: func() error {
				_, err := ExecuteQuery(ServicesQueryRequest{})
				return err
			},
		},
		{
			name:       "execute_query_500",
			statusCode: http.StatusInternalServerError,
			call: func() error {
				_, err := ExecuteQuery(ServicesQueryRequest{})
				return err
			},
		},
		{
			name:       "scan_image_401",
			statusCode: http.StatusUnauthorized,
			call: func() error {
				_, err := ExecuteScanImageQuery(ScanImageServiceRequest{})
				return err
			},
		},
		{
			name:       "scan_image_500",
			statusCode: http.StatusInternalServerError,
			call: func() error {
				_, err := ExecuteScanImageQuery(ScanImageServiceRequest{})
				return err
			},
		},
		{
			name:       "scan_cis_401",
			statusCode: http.StatusUnauthorized,
			call: func() error {
				_, err := ExecuteScanCisQuery(ScanCisServiceRequest{})
				return err
			},
		},
		{
			name:       "scan_cis_500",
			statusCode: http.StatusInternalServerError,
			call: func() error {
				_, err := ExecuteScanCisQuery(ScanCisServiceRequest{})
				return err
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := &trackingReadCloser{Reader: strings.NewReader("upstream exploded")}
			common.HttpClient().Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: tt.statusCode,
					Status:     fmt.Sprintf("%d %s", tt.statusCode, http.StatusText(tt.statusCode)),
					Header:     make(http.Header),
					Body:       body,
					Request:    req,
				}, nil
			})

			err := tt.call()
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), "upstream exploded") {
				t.Fatalf("expected error to include response body, got %q", err.Error())
			}
			if !body.closed {
				t.Fatal("expected response body to be closed")
			}
		})
	}
}

var _ io.ReadCloser = (*trackingReadCloser)(nil)
