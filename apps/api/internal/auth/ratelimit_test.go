package auth

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func doRateLimitedLogin(t *testing.T, store UserStore, issuer TokenIssuer, limiter *LoginRateLimiter, email, password string) int {
	t.Helper()
	refreshIssuer := RefreshTokenIssuer{Store: newFakeRefreshTokenStore(), TTL: time.Hour}
	rec := doLoginVia(t, RateLimitedLoginHandler(store, issuer, refreshIssuer, limiter), email, password)
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
	// El login ahora exige email verificado (ver spec delta de user-auth);
	// este test cubre el rate limiting, no el flujo de verificación.
	user, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	if err := store.MarkEmailVerified(context.Background(), user.ID); err != nil {
		t.Fatalf("unexpected error marking email verified: %v", err)
	}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	limiter := NewLoginRateLimiter(3, time.Minute)

	status := doRateLimitedLogin(t, store, issuer, limiter, "rider@example.com", "correct-horse-battery")
	if status != http.StatusOK {
		t.Fatalf("expected 200 for a correct login, got %d", status)
	}
}

func TestLoginRateLimiter_RecordCountsAgainstTheLimit(t *testing.T) {
	limiter := NewLoginRateLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		if !limiter.Allowed("user-42") {
			t.Fatalf("attempt %d: expected key to still be allowed", i+1)
		}
		limiter.Record("user-42")
	}

	if limiter.Allowed("user-42") {
		t.Fatal("expected key to be blocked after reaching the limit via Record")
	}
}

func TestLoginRateLimiter_RecordFailureIsStillAnAlias(t *testing.T) {
	limiter := NewLoginRateLimiter(1, time.Minute)

	limiter.RecordFailure("user-1")

	if limiter.Allowed("user-1") {
		t.Fatal("expected RecordFailure to still count against the limit")
	}
}
