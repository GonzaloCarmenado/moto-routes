package auth

import (
	"net/http"
	"testing"
	"time"
)

func doRateLimitedLogin(t *testing.T, store UserStore, issuer TokenIssuer, limiter *LoginRateLimiter, email, password string) int {
	t.Helper()
	rec := doLoginVia(t, RateLimitedLoginHandler(store, issuer, limiter), email, password)
	return rec.Code
}

func TestRateLimitedLoginHandler_BlocksAfterTooManyFailedAttempts(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	limiter := NewLoginRateLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		status := doRateLimitedLogin(t, store, issuer, limiter, "rider@example.com", "wrong-password")
		if status != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d", i+1, status)
		}
	}

	// El 4º intento se bloquea por el límite, incluso con la contraseña correcta.
	status := doRateLimitedLogin(t, store, issuer, limiter, "rider@example.com", "correct-horse-battery")
	if status != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after exceeding the failed-attempt limit, got %d", status)
	}
}

func TestRateLimitedLoginHandler_SuccessfulLoginIsNotRateLimited(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	limiter := NewLoginRateLimiter(3, time.Minute)

	status := doRateLimitedLogin(t, store, issuer, limiter, "rider@example.com", "correct-horse-battery")
	if status != http.StatusOK {
		t.Fatalf("expected 200 for a correct login, got %d", status)
	}
}
