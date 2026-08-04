package ping

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeService struct {
	result Result
}

func (f fakeService) Ping(_ context.Context) Result {
	return f.result
}

func TestHandler_HealthyReturns200WithDatabaseTime(t *testing.T) {
	dbTime := time.Date(2026, 8, 4, 12, 0, 0, 0, time.UTC)
	svc := fakeService{result: Healthy(dbTime)}

	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	rec := httptest.NewRecorder()

	Handler(svc).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body Result
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if !body.Healthy {
		t.Fatal("expected healthy=true in response body")
	}
	if body.DatabaseTime == nil || !body.DatabaseTime.Equal(dbTime) {
		t.Fatalf("expected databaseTime=%v, got %v", dbTime, body.DatabaseTime)
	}
	if body.Error != nil {
		t.Fatalf("expected error=null, got %v", *body.Error)
	}
}

func TestHandler_UnhealthyReturns503WithError(t *testing.T) {
	svc := fakeService{result: Unhealthy("connection refused")}

	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	rec := httptest.NewRecorder()

	Handler(svc).ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", rec.Code)
	}

	var body Result
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Healthy {
		t.Fatal("expected healthy=false in response body")
	}
	if body.DatabaseTime != nil {
		t.Fatalf("expected databaseTime=null, got %v", *body.DatabaseTime)
	}
	if body.Error == nil || *body.Error != "connection refused" {
		t.Fatalf("expected error=%q, got %v", "connection refused", body.Error)
	}
}
