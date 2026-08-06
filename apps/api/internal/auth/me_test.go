package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMeHandler_ReturnsAuthenticatedUser(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	stored, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("failed to look up seeded user: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	ctx := context.WithValue(req.Context(), userIDContextKey, stored.ID)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	MeHandler(store).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body meResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Email != "rider@example.com" {
		t.Fatalf("expected email rider@example.com, got %q", body.Email)
	}
	if body.EmailVerified {
		t.Fatal("expected EmailVerified false for a freshly registered account")
	}
}

func TestMeHandler_WithoutContextUserIsDenied(t *testing.T) {
	store := newFakeUserStore()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	MeHandler(store).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
