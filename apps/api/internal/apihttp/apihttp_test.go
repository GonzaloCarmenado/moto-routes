package apihttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

func TestWriteJSON_WritesStatusAndBody(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteJSON(rec, http.StatusOK, map[string]string{"hello": "world"})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %s", rec.Header().Get("Content-Type"))
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body["hello"] != "world" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestWriteError_WritesStatusAndErrorMessage(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteError(rec, http.StatusBadRequest, "invalid request body")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body.Error != "invalid request body" {
		t.Fatalf("unexpected error message: %q", body.Error)
	}
}

func TestRequireUserID_ReturnsUserIDWhenAuthenticated(t *testing.T) {
	issuer := auth.TokenIssuer{Secret: []byte("apihttp-test-secret"), TTL: time.Hour}
	token, err := issuer.Issue(42)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}

	var gotUserID int64
	var gotOK bool
	handler := auth.RequireAuth(issuer)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUserID, gotOK = RequireUserID(w, r)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	if !gotOK || gotUserID != 42 {
		t.Fatalf("expected (42, true), got (%d, %v)", gotUserID, gotOK)
	}
}

func TestRequireUserID_Writes401WithoutAuthContext(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(context.Background())

	userID, ok := RequireUserID(rec, req)

	if ok || userID != 0 {
		t.Fatalf("expected (0, false), got (%d, %v)", userID, ok)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
