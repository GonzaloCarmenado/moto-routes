package auth

import (
	"net/http"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

func TestRateLimitedRegisterHandler_BlocksAfterMaxAttempts(t *testing.T) {
	store := newFakeUserStore()
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	limiter := NewLoginRateLimiter(2, time.Minute)
	handler := RateLimitedRegisterHandler(store, tokenStore, sender, "https://api.example.com", limiter)

	first := doRegisterVia(t, handler, "rider@example.com", "correct-horse-battery")
	second := doRegisterVia(t, handler, "rider@example.com", "wrong-password-retry")
	third := doRegisterVia(t, handler, "rider@example.com", "another-retry-pass")

	if first.Code != http.StatusCreated {
		t.Fatalf("expected the 1st registration to succeed, got %d", first.Code)
	}
	if second.Code != http.StatusConflict {
		t.Fatalf("expected the 2nd attempt (duplicate email) to be a normal 409, got %d", second.Code)
	}
	if third.Code != http.StatusTooManyRequests {
		t.Fatalf("expected the 3rd attempt within the window to be rate limited, got %d", third.Code)
	}
}
