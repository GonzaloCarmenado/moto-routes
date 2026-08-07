package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type fakeStore struct {
	upsertErr error
	upserted  []Detail
	byUser    map[int64][]Route
	byID      map[string]*Detail
}

func newFakeStore() *fakeStore {
	return &fakeStore{byUser: map[int64][]Route{}, byID: map[string]*Detail{}}
}

func (f *fakeStore) Upsert(_ context.Context, _ int64, route Detail) error {
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.upserted = append(f.upserted, route)
	return nil
}

func (f *fakeStore) ListByUser(_ context.Context, userID int64) ([]Route, error) {
	return f.byUser[userID], nil
}

func (f *fakeStore) GetByIDForUser(_ context.Context, _ int64, id string) (*Detail, error) {
	return f.byID[id], nil
}

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("handler-test-secret"), TTL: time.Hour}
}

// bearerFor emite un token válido para userID, para probar el handler
// detrás de auth.RequireAuth (mismo middleware que en producción).
func bearerFor(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testIssuer().Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	return token
}

func doRequest(handler http.Handler, method, url string, body []byte, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, bytes.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

// withURLParam simula el enrutado de chi para handlers que leen chi.URLParam,
// sin necesitar levantar el router completo.
func withURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func sampleUpsertBody() []byte {
	body, _ := json.Marshal(map[string]any{
		"id":             "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"created_at":     "2026-08-07T10:00:00.000Z",
		"duration":       60.0,
		"total_distance": 1000.0,
		"avg_speed":      30.0,
		"status":         "completed",
		"points":         []map[string]any{{"timestamp": 1000, "lat": 40.1, "lng": -3.1, "alt": 600, "speed": 10}},
		"stops":          []map[string]any{},
	})
	return body
}

func TestUpsertHandler_SuccessReturns200AndStoresRoute(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))

	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), bearerFor(t, 42))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.upserted) != 1 || len(store.upserted[0].Points) != 1 {
		t.Fatalf("expected the route to reach the store with its points, got %+v", store.upserted)
	}
}

func TestUpsertHandler_WithoutTokenReturns401(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))

	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestUpsertHandler_TooManyPointsReturns400(t *testing.T) {
	store := newFakeStore()
	store.upsertErr = ErrTooManyPoints
	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))

	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), bearerFor(t, 42))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpsertHandler_CalledTwiceWithSameIDUpdatesInsteadOfDuplicating(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))
	token := bearerFor(t, 42)

	doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), token)
	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), token)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 on the second call, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.upserted) != 2 {
		t.Fatalf("expected the handler to delegate both calls to the store's upsert (idempotency is the store's responsibility), got %d calls", len(store.upserted))
	}
}

func TestListHandler_ReturnsOnlyAuthenticatedUsersRoutes(t *testing.T) {
	store := newFakeStore()
	store.byUser[42] = []Route{{ID: "route-1", Status: "completed"}}
	handler := auth.RequireAuth(testIssuer())(ListHandler(store))

	rec := doRequest(handler, http.MethodGet, "/api/routes", nil, bearerFor(t, 42))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body []Route
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body) != 1 || body[0].ID != "route-1" {
		t.Fatalf("expected exactly the authenticated user's routes, got %+v", body)
	}
}

func TestListHandler_EmptyWhenNothingUploaded(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(ListHandler(store))

	rec := doRequest(handler, http.MethodGet, "/api/routes", nil, bearerFor(t, 42))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body []Route
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("expected an empty list, got %+v", body)
	}
}

func TestListHandler_WithoutTokenReturns401(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(ListHandler(store))

	rec := doRequest(handler, http.MethodGet, "/api/routes", nil, "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestDetailHandler_ReturnsFullDetailForOwnRoute(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{
		Route:  Route{ID: "route-1", Status: "completed"},
		Points: []Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1}},
		Stops:  []Stop{},
	}
	handler := auth.RequireAuth(testIssuer())(DetailHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body Detail
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.Points) != 1 {
		t.Fatalf("expected the full detail with points, got %+v", body)
	}
}

func TestDetailHandler_ReturnsNotFoundWhenMissingOrOtherUsers(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(DetailHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/unknown", nil)
	req = withURLParam(req, "id", "unknown")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDetailHandler_WithoutTokenReturns401(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(DetailHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1", nil)
	req = withURLParam(req, "id", "route-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
