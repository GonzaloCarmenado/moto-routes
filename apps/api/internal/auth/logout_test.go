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

func doLogout(t *testing.T, handler http.Handler, refreshToken string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"refresh_token": refreshToken})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestLogoutHandler_RevokesTheRefreshTokenForFutureExchanges(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	refreshIssuer := RefreshTokenIssuer{Store: refreshStore, TTL: time.Hour}
	rawToken, err := refreshIssuer.IssueFor(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error issuing refresh token: %v", err)
	}

	rec := doLogout(t, LogoutHandler(refreshStore), rawToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	refreshRec := doRefresh(t, RefreshHandler(refreshStore, issuer, time.Hour), rawToken)
	if refreshRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected the revoked refresh token to be rejected on refresh, got %d", refreshRec.Code)
	}
}

func TestLogoutHandler_UnknownTokenStillReturnsSuccess(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()

	rec := doLogout(t, LogoutHandler(refreshStore), "does-not-exist")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected logout to succeed even for an unknown token, got %d", rec.Code)
	}
}

func TestLogoutHandler_MissingTokenStillReturnsSuccess(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()

	rec := doLogout(t, LogoutHandler(refreshStore), "")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected logout to succeed even without a refresh token, got %d", rec.Code)
	}
}
