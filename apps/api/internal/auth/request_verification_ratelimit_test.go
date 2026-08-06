package auth

import (
	"net/http"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

func TestRateLimitedRequestVerificationHandler_BlocksAfterMaxAttempts(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	limiter := NewLoginRateLimiter(2, time.Minute)
	handler := RateLimitedRequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com", limiter)

	first := doRequestVerification(t, handler, "rider@example.com")
	second := doRequestVerification(t, handler, "rider@example.com")
	third := doRequestVerification(t, handler, "rider@example.com")

	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("expected the first 2 requests to succeed, got %d and %d", first.Code, second.Code)
	}
	if third.Code != http.StatusTooManyRequests {
		t.Fatalf("expected the 3rd request within the window to be rate limited, got %d", third.Code)
	}
}

func TestRateLimitedRequestVerificationHandler_DifferentEmailsHaveIndependentLimits(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider-a@example.com", "correct-horse-battery")
	doRegister(t, userStore, "rider-b@example.com", "correct-horse-battery")
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	limiter := NewLoginRateLimiter(1, time.Minute)
	handler := RateLimitedRequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com", limiter)

	firstEmailFirstAttempt := doRequestVerification(t, handler, "rider-a@example.com")
	secondEmailFirstAttempt := doRequestVerification(t, handler, "rider-b@example.com")

	if firstEmailFirstAttempt.Code != http.StatusOK || secondEmailFirstAttempt.Code != http.StatusOK {
		t.Fatalf("expected independent limits per email, got %d and %d", firstEmailFirstAttempt.Code, secondEmailFirstAttempt.Code)
	}
}
