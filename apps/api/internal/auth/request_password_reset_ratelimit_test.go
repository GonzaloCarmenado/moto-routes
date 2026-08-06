package auth

import (
	"net/http"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

func TestRateLimitedRequestPasswordResetHandler_BlocksAfterMaxAttempts(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	tokenStore := newFakePasswordResetTokenStore()
	sender := &email.FakeSender{}
	limiter := NewLoginRateLimiter(2, time.Minute)
	handler := RateLimitedRequestPasswordResetHandler(userStore, tokenStore, sender, "https://api.example.com", limiter)

	first := doRequestPasswordReset(t, handler, "rider@example.com")
	second := doRequestPasswordReset(t, handler, "rider@example.com")
	third := doRequestPasswordReset(t, handler, "rider@example.com")

	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("expected the first 2 requests to succeed, got %d and %d", first.Code, second.Code)
	}
	if third.Code != http.StatusTooManyRequests {
		t.Fatalf("expected the 3rd request within the window to be rate limited, got %d", third.Code)
	}
}
