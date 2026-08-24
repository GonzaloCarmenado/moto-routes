package userdirectory

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

var errBoom = errors.New("boom")

// fakeUserStore es un auth.UserStore en memoria, suficiente para ejercitar
// SearchHandler sin depender de PostgreSQL.
type fakeUserStore struct {
	searchResults []string
	searchErr     error
	lastQuery     string
	lastLimit     int
}

func (f *fakeUserStore) CreateUser(_ context.Context, _, _, _ string) (auth.StoredUser, error) {
	return auth.StoredUser{}, nil
}
func (f *fakeUserStore) FindUserByEmail(_ context.Context, _ string) (auth.StoredUser, error) {
	return auth.StoredUser{}, auth.ErrUserNotFound
}
func (f *fakeUserStore) FindUserByID(_ context.Context, _ int64) (auth.StoredUser, error) {
	return auth.StoredUser{}, auth.ErrUserNotFound
}
func (f *fakeUserStore) FindUserByUsername(_ context.Context, _ string) (auth.StoredUser, error) {
	return auth.StoredUser{}, auth.ErrUserNotFound
}
func (f *fakeUserStore) MarkEmailVerified(_ context.Context, _ int64) error            { return nil }
func (f *fakeUserStore) UpdatePasswordHash(_ context.Context, _ int64, _ string) error { return nil }
func (f *fakeUserStore) UpdateUsername(_ context.Context, _ int64, _ string) error     { return nil }

func (f *fakeUserStore) SearchUsernames(_ context.Context, query string, limit int) ([]string, error) {
	f.lastQuery = query
	f.lastLimit = limit
	return f.searchResults, f.searchErr
}

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("userdirectory-handler-test-secret"), TTL: time.Hour}
}

func bearerFor(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testIssuer().Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	return token
}

func doSearchRequest(handler http.Handler, url, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, url, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestSearchHandler_ReturnsMatchingUsernames(t *testing.T) {
	store := &fakeUserStore{searchResults: []string{"rider_a", "rider_b"}}

	handler := auth.RequireAuth(testIssuer())(SearchHandler(store))
	rec := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body []string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if len(body) != 2 || body[0] != "rider_a" || body[1] != "rider_b" {
		t.Fatalf("expected [rider_a rider_b], got %+v", body)
	}
	if store.lastQuery != "rider" {
		t.Fatalf("expected query 'rider' to reach the store, got %q", store.lastQuery)
	}
}

func TestSearchHandler_LimitsResultsToTen(t *testing.T) {
	store := &fakeUserStore{}

	handler := auth.RequireAuth(testIssuer())(SearchHandler(store))
	doSearchRequest(handler, "/api/users/search?q=a", bearerFor(t, 1))

	if store.lastLimit != 10 {
		t.Fatalf("expected the handler to cap results at 10, got limit %d", store.lastLimit)
	}
}

func TestSearchHandler_EmptyQueryReturnsBadRequest(t *testing.T) {
	store := &fakeUserStore{}

	handler := auth.RequireAuth(testIssuer())(SearchHandler(store))
	rec := doSearchRequest(handler, "/api/users/search", bearerFor(t, 1))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for an empty query, got %d", rec.Code)
	}
}

func TestSearchHandler_RequiresAuthentication(t *testing.T) {
	store := &fakeUserStore{}

	handler := auth.RequireAuth(testIssuer())(SearchHandler(store))
	rec := doSearchRequest(handler, "/api/users/search?q=rider", "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 without a token, got %d", rec.Code)
	}
}

func TestSearchHandler_StoreErrorReturnsInternalServerError(t *testing.T) {
	store := &fakeUserStore{searchErr: errBoom}

	handler := auth.RequireAuth(testIssuer())(SearchHandler(store))
	rec := doSearchRequest(handler, "/api/users/search?q=rider", bearerFor(t, 1))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 on a store error, got %d", rec.Code)
	}
}
