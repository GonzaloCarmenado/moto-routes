package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type fakeStore struct {
	upsertErr error
	upserted  []Detail
	// upsertPoints, si no es nil, es lo que Upsert devuelve en vez de
	// simplemente devolver route.Points sin cambios — para simular una
	// normalización que ajustó algún punto.
	upsertPoints []Point
	byUser       map[int64][]Route
	byID         map[string]*Detail
}

func newFakeStore() *fakeStore {
	return &fakeStore{byUser: map[int64][]Route{}, byID: map[string]*Detail{}}
}

func (f *fakeStore) Upsert(_ context.Context, _ int64, route Detail) ([]Point, error) {
	if f.upsertErr != nil {
		return nil, f.upsertErr
	}
	f.upserted = append(f.upserted, route)
	if f.upsertPoints != nil {
		return f.upsertPoints, nil
	}
	return route.Points, nil
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

func TestUpsertHandler_ResponseIncludesMatchedPointsWhenNormalized(t *testing.T) {
	store := newFakeStore()
	matchedLat, matchedLng := 40.1001, -3.1001
	store.upsertPoints = []Point{
		{Timestamp: 1000, Lat: 40.1, Lng: -3.1, Alt: 600, Speed: 10, MatchedLat: &matchedLat, MatchedLng: &matchedLng},
	}
	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))

	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), bearerFor(t, 42))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body upsertResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.Points) != 1 || body.Points[0].MatchedLat == nil || *body.Points[0].MatchedLat != matchedLat {
		t.Fatalf("expected the response to include the matched point, got %+v", body.Points)
	}
}

func TestUpsertHandler_ResponseEchoesRawPointsWithoutNormalization(t *testing.T) {
	store := newFakeStore() // sin upsertPoints — el doble echoa route.Points tal cual, sin matched_*

	handler := auth.RequireAuth(testIssuer())(UpsertHandler(store))

	rec := doRequest(handler, http.MethodPost, "/api/routes", sampleUpsertBody(), bearerFor(t, 42))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body upsertResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.Points) != 1 || body.Points[0].Lat != 40.1 || body.Points[0].MatchedLat != nil {
		t.Fatalf("expected the raw point without any matched fields, got %+v", body.Points)
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

func floatPtr(v float64) *float64 { return &v }

func TestGPXExportHandler_UsesMatchedPointsWhenNormalized(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{
		Route:  Route{ID: "route-1", Status: "completed"},
		Points: []Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1, MatchedLat: floatPtr(40.1001), MatchedLng: floatPtr(-3.1001)}},
		Stops:  []Stop{},
	}
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1/export.gpx", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var doc gpxDoc
	if err := xml.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("expected well-formed GPX, got error: %v", err)
	}
	if len(doc.Track.Segments) != 1 || len(doc.Track.Segments[0].Points) != 1 {
		t.Fatalf("expected exactly 1 track point, got %+v", doc.Track)
	}
	got := doc.Track.Segments[0].Points[0]
	if got.Lat != 40.1001 || got.Lon != -3.1001 {
		t.Fatalf("expected the matched (road-snapped) coordinates, got lat=%v lon=%v", got.Lat, got.Lon)
	}
}

func TestGPXExportHandler_FallsBackToRawPointsWhenNotNormalized(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{
		Route:  Route{ID: "route-1", Status: "completed"},
		Points: []Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1}},
		Stops:  []Stop{},
	}
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1/export.gpx", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var doc gpxDoc
	if err := xml.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("expected well-formed GPX, got error: %v", err)
	}
	got := doc.Track.Segments[0].Points[0]
	if got.Lat != 40.1 || got.Lon != -3.1 {
		t.Fatalf("expected the raw coordinates, got lat=%v lon=%v", got.Lat, got.Lon)
	}
}

func TestGPXExportHandler_ReturnsNotFoundForMissingOrOtherUsersRoute(t *testing.T) {
	store := newFakeStore()
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/unknown/export.gpx", nil)
	req = withURLParam(req, "id", "unknown")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGPXExportHandler_ReturnsBadRequestForRouteWithoutPoints(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{Route: Route{ID: "route-1", Status: "completed"}, Points: []Point{}, Stops: []Stop{}}
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1/export.gpx", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGPXExportHandler_IncludesStopsAsWaypoints(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{
		Route:  Route{ID: "route-1", Status: "completed"},
		Points: []Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1}},
		Stops: []Stop{
			{StartTime: 1200, Lat: 40.15, Lng: -3.15, Type: "manual"},
			{StartTime: 1400, Lat: 40.16, Lng: -3.16, Type: "auto"},
		},
	}
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1/export.gpx", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var doc gpxDoc
	if err := xml.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("expected well-formed GPX, got error: %v", err)
	}
	if len(doc.Waypoints) != 2 {
		t.Fatalf("expected 2 waypoints (one per stop), got %d", len(doc.Waypoints))
	}
	if doc.Waypoints[0].Lat != 40.15 || doc.Waypoints[1].Lat != 40.16 {
		t.Fatalf("expected each waypoint to carry its stop's position, got %+v", doc.Waypoints)
	}
}

func TestGPXExportHandler_ProducesWellFormedGPX11Document(t *testing.T) {
	store := newFakeStore()
	store.byID["route-1"] = &Detail{
		Route:  Route{ID: "route-1", Status: "completed"},
		Points: []Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1}},
		Stops:  []Stop{},
	}
	handler := auth.RequireAuth(testIssuer())(GPXExportHandler(store))

	req := httptest.NewRequest(http.MethodGet, "/api/routes/route-1/export.gpx", nil)
	req = withURLParam(req, "id", "route-1")
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 42))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.HasPrefix(body, xml.Header) {
		t.Fatalf("expected the response to start with the XML declaration, got: %s", body[:min(len(body), 80)])
	}
	if !strings.Contains(body, `xmlns="http://www.topografix.com/GPX/1/1"`) || !strings.Contains(body, `version="1.1"`) {
		t.Fatalf("expected a GPX 1.1 document, got: %s", body)
	}

	var doc gpxDoc
	if err := xml.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatalf("expected well-formed XML, got error: %v", err)
	}
	if doc.XMLName.Local != "gpx" {
		t.Fatalf("expected the root element to be <gpx>, got <%s>", doc.XMLName.Local)
	}
	if rec.Header().Get("Content-Type") != "application/gpx+xml" {
		t.Fatalf("expected Content-Type application/gpx+xml, got %q", rec.Header().Get("Content-Type"))
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
