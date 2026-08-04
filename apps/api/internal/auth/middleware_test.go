package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func protectedOK() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
}

func TestRequireAuth_ValidTokenGrantsAccess(t *testing.T) {
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	token, err := issuer.Issue(42)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	RequireAuth(issuer)(protectedOK()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRequireAuth_MissingTokenIsDenied(t *testing.T) {
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	rec := httptest.NewRecorder()

	RequireAuth(issuer)(protectedOK()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestRequireAuth_ExpiredTokenIsDenied(t *testing.T) {
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: -time.Hour}
	token, err := issuer.Issue(42)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	RequireAuth(issuer)(protectedOK()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestRequireAuth_InvalidSignatureIsDenied(t *testing.T) {
	issuedBy := TokenIssuer{Secret: []byte("other-secret"), TTL: time.Hour}
	verifiedBy := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	token, err := issuedBy.Issue(42)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	RequireAuth(verifiedBy)(protectedOK()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
