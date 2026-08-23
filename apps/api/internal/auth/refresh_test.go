package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func doRefresh(t *testing.T, handler http.Handler, refreshToken string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"refresh_token": refreshToken})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRefreshHandler_ValidTokenReturnsNewAccessAndRefreshToken(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	refreshIssuer := RefreshTokenIssuer{Store: refreshStore, TTL: time.Hour}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	rawToken, err := refreshIssuer.IssueFor(context.Background(), 7)
	if err != nil {
		t.Fatalf("unexpected error issuing refresh token: %v", err)
	}

	rec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), rawToken)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	newAccessToken, _ := body["token"].(string)
	if newAccessToken == "" {
		t.Fatal("expected a non-empty access token")
	}
	if userID, err := issuer.Verify(newAccessToken); err != nil || userID != 7 {
		t.Fatalf("expected the new access token to verify for userID 7, got userID=%d err=%v", userID, err)
	}
	newRefreshToken, _ := body["refresh_token"].(string)
	if newRefreshToken == "" || newRefreshToken == rawToken {
		t.Fatal("expected a new, distinct refresh token in the response")
	}
}

func TestRefreshHandler_RotatesTheOldRefreshTokenSoItCannotBeReused(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	refreshIssuer := RefreshTokenIssuer{Store: refreshStore, TTL: time.Hour}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	rawToken, err := refreshIssuer.IssueFor(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error issuing refresh token: %v", err)
	}
	handler := RefreshHandler(refreshStore, issuer, time.Hour)

	first := doRefresh(t, handler, rawToken)
	if first.Code != http.StatusOK {
		t.Fatalf("expected the first refresh to succeed, got %d: %s", first.Code, first.Body.String())
	}

	second := doRefresh(t, handler, rawToken)
	if second.Code != http.StatusUnauthorized {
		t.Fatalf("expected the second refresh reusing the same token to be rejected, got %d", second.Code)
	}
}

func TestRefreshHandler_UnknownTokenIsRejected(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}

	rec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), "not-a-real-token")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for an unknown refresh token, got %d", rec.Code)
	}
}

func TestRefreshHandler_ExpiredTokenIsRejected(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	rawToken, err := generateOneTimeToken()
	if err != nil {
		t.Fatalf("unexpected error generating token: %v", err)
	}
	if err := refreshStore.Create(context.Background(), 1, hashOneTimeToken(rawToken), time.Now().Add(-time.Hour)); err != nil {
		t.Fatalf("unexpected error seeding expired token: %v", err)
	}

	rec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), rawToken)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for an expired refresh token, got %d", rec.Code)
	}
}

func TestRefreshHandler_RevokedTokenIsRejected(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	refreshIssuer := RefreshTokenIssuer{Store: refreshStore, TTL: time.Hour}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	rawToken, err := refreshIssuer.IssueFor(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error issuing refresh token: %v", err)
	}
	if err := refreshStore.Revoke(context.Background(), hashOneTimeToken(rawToken)); err != nil {
		t.Fatalf("unexpected error revoking token: %v", err)
	}

	rec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), rawToken)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for a revoked refresh token, got %d", rec.Code)
	}
}

func TestRefreshHandler_MissingTokenIsRejected(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}

	rec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for an empty refresh token, got %d", rec.Code)
	}
}
