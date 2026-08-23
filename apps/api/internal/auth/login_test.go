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

func doLogin(t *testing.T, store UserStore, issuer TokenIssuer, email, password string) *httptest.ResponseRecorder {
	t.Helper()
	refreshIssuer := RefreshTokenIssuer{Store: newFakeRefreshTokenStore(), TTL: time.Hour}
	return doLoginVia(t, LoginHandler(store, issuer, refreshIssuer), email, password)
}

func doLoginVia(t *testing.T, handler http.Handler, email, password string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestLoginHandler_ValidCredentialsReturnAToken(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	// El login ahora exige email verificado (ver spec delta de user-auth); se
	// marca aquí a mano porque este test cubre el camino feliz de login, no
	// el flujo de verificación en sí.
	user, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	if err := store.MarkEmailVerified(context.Background(), user.ID); err != nil {
		t.Fatalf("unexpected error marking email verified: %v", err)
	}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}

	rec := doLogin(t, store, issuer, "rider@example.com", "correct-horse-battery")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["token"] == "" {
		t.Fatal("expected a non-empty token in the response")
	}
	if _, err := issuer.Verify(body["token"].(string)); err != nil {
		t.Fatalf("expected the issued token to verify: %v", err)
	}
	if body["refresh_token"] == "" {
		t.Fatal("expected a non-empty refresh_token in the response")
	}
	if body["refresh_token"] == body["token"] {
		t.Fatal("expected the refresh token to be distinct from the access token")
	}
}

func TestLoginHandler_ValidCredentialsReturnExpiresIn(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	user, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	if err := store.MarkEmailVerified(context.Background(), user.ID); err != nil {
		t.Fatalf("unexpected error marking email verified: %v", err)
	}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	refreshIssuer := RefreshTokenIssuer{Store: newFakeRefreshTokenStore(), TTL: time.Hour}

	rec := doLoginVia(t, LoginHandler(store, issuer, refreshIssuer), "rider@example.com", "correct-horse-battery")

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	expiresIn, ok := body["expires_in"].(float64)
	if !ok {
		t.Fatalf("expected a numeric expires_in field, got %v", body["expires_in"])
	}
	if expiresIn != (30 * time.Minute).Seconds() {
		t.Fatalf("expected expires_in to be %v seconds, got %v", (30 * time.Minute).Seconds(), expiresIn)
	}
}

func TestLoginHandler_UnknownEmailAndWrongPasswordReturnTheSameGenericError(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}

	unknownEmailRec := doLogin(t, store, issuer, "ghost@example.com", "whatever-password")
	wrongPasswordRec := doLogin(t, store, issuer, "rider@example.com", "wrong-password")

	if unknownEmailRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for unknown email, got %d", unknownEmailRec.Code)
	}
	if wrongPasswordRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 for wrong password, got %d", wrongPasswordRec.Code)
	}
	if unknownEmailRec.Body.String() != wrongPasswordRec.Body.String() {
		t.Fatalf("expected identical generic error bodies, got %q vs %q",
			unknownEmailRec.Body.String(), wrongPasswordRec.Body.String())
	}
}

func TestLoginHandler_CorrectCredentialsButUnverifiedEmailIsRejected(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}

	rec := doLogin(t, store, issuer, "rider@example.com", "correct-horse-battery")

	if rec.Code == http.StatusOK {
		t.Fatalf("expected login to be rejected for an unverified account, got 200: %s", rec.Body.String())
	}

	wrongPasswordRec := doLogin(t, store, issuer, "rider@example.com", "wrong-password")
	if rec.Body.String() == wrongPasswordRec.Body.String() {
		t.Fatal("expected the unverified-email error to be distinguishable from the wrong-credentials error")
	}
}
