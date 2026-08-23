package auth

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestRateLimitedRefreshHandler_BlocksAfterTooManyFailedAttempts(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	limiter := NewLoginRateLimiter(3, time.Minute)
	handler := RateLimitedRefreshHandler(refreshStore, issuer, time.Hour, limiter)

	for range 3 {
		rec := doRefresh(t, handler, "bad-token")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401 for a bad token, got %d", rec.Code)
		}
	}

	rec := doRefresh(t, handler, "bad-token")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 after exceeding the limit, got %d", rec.Code)
	}
}

func TestRateLimitedRefreshHandler_SuccessfulRefreshIsNotRateLimited(t *testing.T) {
	refreshStore := newFakeRefreshTokenStore()
	refreshIssuer := RefreshTokenIssuer{Store: refreshStore, TTL: time.Hour}
	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: 30 * time.Minute}
	limiter := NewLoginRateLimiter(1, time.Minute)
	handler := RateLimitedRefreshHandler(refreshStore, issuer, time.Hour, limiter)

	rawToken, err := refreshIssuer.IssueFor(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error issuing refresh token: %v", err)
	}

	rec := doRefresh(t, handler, rawToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected the successful refresh to go through, got %d: %s", rec.Code, rec.Body.String())
	}
}
