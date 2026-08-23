package userdirectory

import (
	"net/http"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

func TestRateLimitedSearchHandler_BlocksAfterTooManySearches(t *testing.T) {
	store := &fakeUserStore{searchResults: []string{"rider1"}}
	limiter := auth.NewLoginRateLimiter(1, time.Minute)

	handler := auth.RequireAuth(testIssuer())(RateLimitedSearchHandler(store, limiter))

	first := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 1))
	if first.Code != http.StatusOK {
		t.Fatalf("expected first search to succeed, got %d", first.Code)
	}

	second := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 1))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on the second search, got %d", second.Code)
	}
}

func TestRateLimitedSearchHandler_KeyedPerUser(t *testing.T) {
	store := &fakeUserStore{searchResults: []string{"rider1"}}
	limiter := auth.NewLoginRateLimiter(1, time.Minute)

	handler := auth.RequireAuth(testIssuer())(RateLimitedSearchHandler(store, limiter))

	first := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 1))
	if first.Code != http.StatusOK {
		t.Fatalf("expected user 1's search to succeed, got %d", first.Code)
	}

	otherUser := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 2))
	if otherUser.Code != http.StatusOK {
		t.Fatalf("expected user 2's search to be unaffected by user 1's limit, got %d", otherUser.Code)
	}
}
