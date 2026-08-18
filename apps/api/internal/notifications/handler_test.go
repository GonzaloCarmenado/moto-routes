package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type fakeDeviceTokenStore struct {
	upserted []struct {
		userID   int64
		token    string
		platform string
	}
	failWith error
}

func (s *fakeDeviceTokenStore) Upsert(_ context.Context, userID int64, token, platform string) error {
	if s.failWith != nil {
		return s.failWith
	}
	s.upserted = append(s.upserted, struct {
		userID   int64
		token    string
		platform string
	}{userID, token, platform})
	return nil
}

func (s *fakeDeviceTokenStore) TokensForUser(context.Context, int64) ([]string, error) {
	return nil, nil
}
func (s *fakeDeviceTokenStore) Delete(context.Context, string) error { return nil }

func authenticatedRequest(t *testing.T, userID int64, body []byte) *http.Request {
	t.Helper()
	issuer := auth.TokenIssuer{Secret: []byte("notifications-test-secret"), TTL: time.Hour}
	token, err := issuer.Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/device-tokens", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func wrapWithAuth(userID int64, handler http.Handler) http.Handler {
	issuer := auth.TokenIssuer{Secret: []byte("notifications-test-secret"), TTL: time.Hour}
	return auth.RequireAuth(issuer)(handler)
}

func TestRegisterDeviceTokenHandler_RegistersTokenForAuthenticatedUser(t *testing.T) {
	store := &fakeDeviceTokenStore{}
	handler := wrapWithAuth(7, RegisterDeviceTokenHandler(store))

	body, _ := json.Marshal(map[string]string{"token": "fcm-token-123", "platform": "android"})
	req := authenticatedRequest(t, 7, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.upserted) != 1 || store.upserted[0].token != "fcm-token-123" || store.upserted[0].userID != 7 {
		t.Fatalf("expected token registered for user 7, got %+v", store.upserted)
	}
}

func TestRegisterDeviceTokenHandler_Returns401WithoutAuth(t *testing.T) {
	store := &fakeDeviceTokenStore{}
	handler := RegisterDeviceTokenHandler(store)

	body, _ := json.Marshal(map[string]string{"token": "fcm-token-123"})
	req := httptest.NewRequest(http.MethodPost, "/api/device-tokens", bytes.NewReader(body)).WithContext(context.Background())
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestRegisterDeviceTokenHandler_Returns400WithoutToken(t *testing.T) {
	store := &fakeDeviceTokenStore{}
	handler := wrapWithAuth(7, RegisterDeviceTokenHandler(store))

	body, _ := json.Marshal(map[string]string{"platform": "android"})
	req := authenticatedRequest(t, 7, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestRegisterDeviceTokenHandler_DefaultsPlatformToAndroid(t *testing.T) {
	store := &fakeDeviceTokenStore{}
	handler := wrapWithAuth(7, RegisterDeviceTokenHandler(store))

	body, _ := json.Marshal(map[string]string{"token": "fcm-token-123"})
	req := authenticatedRequest(t, 7, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if len(store.upserted) != 1 || store.upserted[0].platform != "android" {
		t.Fatalf("expected default platform android, got %+v", store.upserted)
	}
}

func TestRegisterDeviceTokenHandler_Returns500WhenStoreFails(t *testing.T) {
	store := &fakeDeviceTokenStore{failWith: errors.New("db down")}
	handler := wrapWithAuth(7, RegisterDeviceTokenHandler(store))

	body, _ := json.Marshal(map[string]string{"token": "fcm-token-123"})
	req := authenticatedRequest(t, 7, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}
