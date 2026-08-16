package achievements

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type fakeAchievementStore struct {
	granted     map[int64][]Achievement
	grantErr    error
	progress    map[int64][]Progress
	progressErr error
}

func newFakeAchievementStore() *fakeAchievementStore {
	return &fakeAchievementStore{granted: map[int64][]Achievement{}, progress: map[int64][]Progress{}}
}

func (f *fakeAchievementStore) Aggregates(_ context.Context, _ int64) (Aggregates, error) {
	return Aggregates{}, nil
}

func (f *fakeAchievementStore) CheckAndGrant(_ context.Context, userID int64) ([]Achievement, error) {
	if f.grantErr != nil {
		return nil, f.grantErr
	}
	return f.granted[userID], nil
}

func (f *fakeAchievementStore) ListWithProgress(_ context.Context, userID int64) ([]Progress, error) {
	if f.progressErr != nil {
		return nil, f.progressErr
	}
	return f.progress[userID], nil
}

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("achievements-handler-test-secret"), TTL: time.Hour}
}

func bearerFor(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testIssuer().Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	return token
}

func doRequest(handler http.Handler, method, url, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestCheckHandler_ReturnsOnlyNewlyGrantedAchievements(t *testing.T) {
	store := newFakeAchievementStore()
	store.granted[1] = []Achievement{{ID: 1, Key: "test", Title: "Logro de test"}}

	handler := auth.RequireAuth(testIssuer())(CheckHandler(store))
	rec := doRequest(handler, http.MethodPost, "/api/achievements/check", bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var granted []Achievement
	if err := json.Unmarshal(rec.Body.Bytes(), &granted); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(granted) != 1 || granted[0].Key != "test" {
		t.Fatalf("expected the granted achievement in the response, got %+v", granted)
	}
}

func TestCheckHandler_RequiresAuthentication(t *testing.T) {
	store := newFakeAchievementStore()
	handler := auth.RequireAuth(testIssuer())(CheckHandler(store))
	rec := doRequest(handler, http.MethodPost, "/api/achievements/check", "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a token, got %d", rec.Code)
	}
}

func TestListHandler_ReturnsCatalogWithUserProgress(t *testing.T) {
	store := newFakeAchievementStore()
	achievedAt := "2026-08-10T10:00:00Z"
	store.progress[1] = []Progress{
		{Achievement: Achievement{ID: 1, Key: "achieved"}, AchievedAt: &achievedAt, Current: 100},
		{Achievement: Achievement{ID: 2, Key: "pending"}, AchievedAt: nil, Current: 40},
	}

	handler := auth.RequireAuth(testIssuer())(ListHandler(store))
	rec := doRequest(handler, http.MethodGet, "/api/achievements", bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var progress []Progress
	if err := json.Unmarshal(rec.Body.Bytes(), &progress); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(progress) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(progress))
	}
	if progress[0].AchievedAt == nil || progress[1].AchievedAt != nil {
		t.Fatalf("expected the first entry achieved and the second pending, got %+v", progress)
	}
}

func TestListHandler_RequiresAuthentication(t *testing.T) {
	store := newFakeAchievementStore()
	handler := auth.RequireAuth(testIssuer())(ListHandler(store))
	rec := doRequest(handler, http.MethodGet, "/api/achievements", "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a token, got %d", rec.Code)
	}
}
