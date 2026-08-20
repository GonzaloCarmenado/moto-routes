package routes

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/mapmatch"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testStore(t *testing.T) PostgresRouteStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_routes")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresRouteStore{Pool: pool}
}

// fakeMatcher es un doble de mapmatch.Client para probar la normalización
// best-effort del upsert sin depender de un servicio OSRM real.
type fakeMatcher struct {
	err    error
	adjust func(points []mapmatch.Point) []*mapmatch.Point
	calls  [][]mapmatch.Point
}

func (f *fakeMatcher) Match(_ context.Context, points []mapmatch.Point) ([]*mapmatch.Point, error) {
	f.calls = append(f.calls, points)
	if f.err != nil {
		return nil, f.err
	}
	if f.adjust != nil {
		return f.adjust(points), nil
	}
	adjusted := make([]*mapmatch.Point, len(points))
	for i, p := range points {
		adjusted[i] = &mapmatch.Point{Lat: p.Lat + 0.0001, Lng: p.Lng + 0.0001}
	}
	return adjusted, nil
}

func matchedColumns(t *testing.T, pool *pgxpool.Pool, routeID string, timestamp int64) (*float64, *float64) {
	t.Helper()
	var lat, lng *float64
	err := pool.QueryRow(context.Background(),
		"SELECT matched_lat, matched_lng FROM route_points WHERE route_id = $1 AND timestamp = $2",
		routeID, timestamp,
	).Scan(&lat, &lng)
	if err != nil {
		t.Fatalf("failed to read matched columns: %v", err)
	}
	return lat, lng
}

func seedUser(t *testing.T, pool *pgxpool.Pool, email string) int64 {
	t.Helper()

	var id int64
	err := pool.QueryRow(context.Background(),
		"INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id", email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
	return id
}

func sampleDetail(id string) Detail {
	endTime := int64(2100)
	category := int64(1)
	return Detail{
		Route: Route{
			ID:            id,
			CreatedAt:     "2026-08-07T10:00:00.000Z",
			Duration:      120.5,
			TotalDistance: 3200.4,
			AvgSpeed:      45.2,
			Status:        "completed",
		},
		Points: []Point{
			{Timestamp: 1000, Lat: 40.1, Lng: -3.1, Alt: 650, Speed: 12},
			{Timestamp: 2000, Lat: 40.2, Lng: -3.2, Alt: 655, Speed: 14},
		},
		Stops: []Stop{
			{StartTime: 1500, EndTime: &endTime, Lat: 40.15, Lng: -3.15, Type: "manual", StopCategoryID: &category},
		},
	}
}

func TestPostgresRouteStore_UpsertInsertsNewRouteWithPointsAndStops(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "rider1@example.com")
	detail := sampleDetail("11111111-1111-1111-1111-111111111111")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected the route to exist")
	}
	if len(got.Points) != 2 || len(got.Stops) != 1 {
		t.Fatalf("expected 2 points and 1 stop, got %d points and %d stops", len(got.Points), len(got.Stops))
	}
}

func TestPostgresRouteStore_UpsertCalledTwiceReplacesDataWithoutDuplicating(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "rider2@example.com")
	detail := sampleDetail("22222222-2222-2222-2222-222222222222")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error on first upsert: %v", err)
	}

	updated := detail
	updated.Duration = 200
	updated.Points = []Point{{Timestamp: 3000, Lat: 41.0, Lng: -4.0, Alt: 700, Speed: 20}}
	updated.Stops = []Stop{}

	if _, err := store.Upsert(context.Background(), userID, updated); err != nil {
		t.Fatalf("unexpected error on second upsert: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Duration != 200 {
		t.Fatalf("expected duration to be updated to 200, got %v", got.Duration)
	}
	if len(got.Points) != 1 {
		t.Fatalf("expected route_points to be replaced (1 row), got %d", len(got.Points))
	}
	if len(got.Stops) != 0 {
		t.Fatalf("expected route_stops to be replaced (0 rows), got %d", len(got.Stops))
	}
}

func TestPostgresRouteStore_UpsertRejectsRouteExceedingMaxPoints(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "rider3@example.com")

	detail := sampleDetail("33333333-3333-3333-3333-333333333333")
	detail.Points = make([]Point, MaxPoints+1)

	if _, err := store.Upsert(context.Background(), userID, detail); err != ErrTooManyPoints {
		t.Fatalf("expected ErrTooManyPoints, got %v", err)
	}
}

func TestPostgresRouteStore_UpsertNeverOverwritesAnotherUsersRoute(t *testing.T) {
	store := testStore(t)
	owner := seedUser(t, store.Pool, "owner@example.com")
	attacker := seedUser(t, store.Pool, "attacker@example.com")

	detail := sampleDetail("44444444-4444-4444-4444-444444444444")
	if _, err := store.Upsert(context.Background(), owner, detail); err != nil {
		t.Fatalf("unexpected error seeding owner's route: %v", err)
	}

	tampered := detail
	tampered.Duration = 999
	if _, err := store.Upsert(context.Background(), attacker, tampered); err != ErrRouteOwnedByAnotherUser {
		t.Fatalf("expected ErrRouteOwnedByAnotherUser, got %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), owner, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Duration == 999 {
		t.Fatal("expected the owner's route to remain untouched by the attacker's upsert")
	}
}

func TestPostgresRouteStore_ListByUserReturnsOnlySummariesForThatUser(t *testing.T) {
	store := testStore(t)
	userA := seedUser(t, store.Pool, "user-a@example.com")
	userB := seedUser(t, store.Pool, "user-b@example.com")

	if _, err := store.Upsert(context.Background(), userA, sampleDetail("55555555-5555-5555-5555-555555555555")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := store.Upsert(context.Background(), userB, sampleDetail("66666666-6666-6666-6666-666666666666")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	listA, err := store.ListByUser(context.Background(), userA)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(listA) != 1 || listA[0].ID != "55555555-5555-5555-5555-555555555555" {
		t.Fatalf("expected exactly user A's route, got %+v", listA)
	}
}

func TestPostgresRouteStore_ListByUserIsEmptyWhenNothingUploaded(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "no-routes@example.com")

	list, err := store.ListByUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected an empty list, got %d", len(list))
	}
}

func TestPostgresRouteStore_GetByIDForUserReturnsNilForAnotherUsersRoute(t *testing.T) {
	store := testStore(t)
	owner := seedUser(t, store.Pool, "owner2@example.com")
	other := seedUser(t, store.Pool, "other2@example.com")
	detail := sampleDetail("77777777-7777-7777-7777-777777777777")

	if _, err := store.Upsert(context.Background(), owner, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), other, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for another user's route, got %+v", got)
	}
}

func TestPostgresRouteStore_GetByIDForUserReturnsNilWhenNotFound(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "nobody@example.com")

	got, err := store.GetByIDForUser(context.Background(), userID, "88888888-8888-8888-8888-888888888888")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for a non-existent route, got %+v", got)
	}
}

func TestPostgresRouteStore_UpsertDefaultsIsFavoriteToFalse(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "fav1@example.com")
	detail := sampleDetail("99999999-9999-9999-9999-999999999999")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.IsFavorite {
		t.Fatalf("expected IsFavorite to default to false, got true")
	}
}

func TestPostgresRouteStore_UpsertPersistsIsFavorite(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "fav2@example.com")
	detail := sampleDetail("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	detail.IsFavorite = true

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.IsFavorite {
		t.Fatal("expected IsFavorite to be true")
	}

	unfavorited := detail
	unfavorited.IsFavorite = false
	if _, err := store.Upsert(context.Background(), userID, unfavorited); err != nil {
		t.Fatalf("unexpected error on second upsert: %v", err)
	}
	got, err = store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.IsFavorite {
		t.Fatal("expected IsFavorite to be false after re-upserting with false")
	}
}

func TestPostgresRouteStore_UpsertFillsMatchedColumnsWhenMatcherSucceeds(t *testing.T) {
	store := testStore(t)
	store.Matcher = &fakeMatcher{}
	userID := seedUser(t, store.Pool, "matcher1@example.com")
	detail := sampleDetail("cccccccc-cccc-cccc-cccc-cccccccccccc")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	lat, lng := matchedColumns(t, store.Pool, detail.ID, detail.Points[0].Timestamp)
	if lat == nil || lng == nil {
		t.Fatalf("expected matched_lat/matched_lng to be filled, got %v/%v", lat, lng)
	}
	wantLat := detail.Points[0].Lat + 0.0001
	if *lat != wantLat {
		t.Fatalf("expected matched_lat %v, got %v", wantLat, *lat)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Points[0].Lat != detail.Points[0].Lat || got.Points[0].Lng != detail.Points[0].Lng {
		t.Fatalf("expected the original GPS point to remain untouched by normalization, got %+v", got.Points[0])
	}
}

func TestPostgresRouteStore_UpsertSucceedsWithRawPointsWhenMatcherFails(t *testing.T) {
	store := testStore(t)
	store.Matcher = &fakeMatcher{err: errors.New("osrm unavailable")}
	userID := seedUser(t, store.Pool, "matcher2@example.com")
	detail := sampleDetail("dddddddd-dddd-dddd-dddd-dddddddddddd")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("expected upsert to succeed even if the matcher fails, got: %v", err)
	}

	lat, lng := matchedColumns(t, store.Pool, detail.ID, detail.Points[0].Timestamp)
	if lat != nil || lng != nil {
		t.Fatalf("expected matched_lat/matched_lng to stay NULL when the matcher fails, got %v/%v", lat, lng)
	}
}

func TestPostgresRouteStore_UpsertReturnsPointsWithMatchedFieldsWhenMatcherSucceeds(t *testing.T) {
	store := testStore(t)
	store.Matcher = &fakeMatcher{}
	userID := seedUser(t, store.Pool, "matcher5@example.com")
	detail := sampleDetail("11111111-2222-3333-4444-555555555555")

	points, err := store.Upsert(context.Background(), userID, detail)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(points) != len(detail.Points) {
		t.Fatalf("expected %d points, got %d", len(detail.Points), len(points))
	}
	if points[0].MatchedLat == nil || points[0].MatchedLng == nil {
		t.Fatalf("expected matched_lat/matched_lng to be filled in the returned points, got %+v", points[0])
	}
	wantLat := detail.Points[0].Lat + 0.0001
	if *points[0].MatchedLat != wantLat {
		t.Fatalf("expected matched_lat %v, got %v", wantLat, *points[0].MatchedLat)
	}
	if points[0].Lat != detail.Points[0].Lat {
		t.Fatalf("expected the returned point to keep the original GPS position alongside the matched one, got %+v", points[0])
	}
}

func TestPostgresRouteStore_UpsertReturnsRawPointsWhenMatcherFails(t *testing.T) {
	store := testStore(t)
	store.Matcher = &fakeMatcher{err: errors.New("osrm unavailable")}
	userID := seedUser(t, store.Pool, "matcher6@example.com")
	detail := sampleDetail("66666666-7777-8888-9999-000000000000")

	points, err := store.Upsert(context.Background(), userID, detail)
	if err != nil {
		t.Fatalf("expected upsert to succeed even if the matcher fails, got: %v", err)
	}
	if len(points) != len(detail.Points) {
		t.Fatalf("expected %d points, got %d", len(detail.Points), len(points))
	}
	for i, p := range points {
		if p.MatchedLat != nil || p.MatchedLng != nil {
			t.Fatalf("expected no matched fields when the matcher fails, got %+v at index %d", p, i)
		}
	}
}

func TestPostgresRouteStore_UpsertReturnsRawPointsWhenNoMatcherConfigured(t *testing.T) {
	store := testStore(t) // sin Matcher — comportamiento por defecto
	userID := seedUser(t, store.Pool, "matcher7@example.com")
	detail := sampleDetail("77777777-8888-9999-0000-111111111111")

	points, err := store.Upsert(context.Background(), userID, detail)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(points) != len(detail.Points) || points[0].MatchedLat != nil || points[0].MatchedLng != nil {
		t.Fatalf("expected the raw points without any matched fields, got %+v", points)
	}
}

func TestPostgresRouteStore_UpsertNormalizationDoesNotAlterStops(t *testing.T) {
	store := testStore(t)
	store.Matcher = &fakeMatcher{}
	userID := seedUser(t, store.Pool, "matcher3@example.com")
	detail := sampleDetail("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := store.GetByIDForUser(context.Background(), userID, detail.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Stops) != 1 || got.Stops[0].Lat != detail.Stops[0].Lat || got.Stops[0].Lng != detail.Stops[0].Lng {
		t.Fatalf("expected the stop position to remain untouched by normalization, got %+v", got.Stops)
	}
}

func TestPostgresRouteStore_UpsertSkipsNormalizationWhenNoMatcherConfigured(t *testing.T) {
	store := testStore(t) // sin Matcher — comportamiento por defecto
	userID := seedUser(t, store.Pool, "matcher4@example.com")
	detail := sampleDetail("ffffffff-ffff-ffff-ffff-ffffffffffff")

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	lat, lng := matchedColumns(t, store.Pool, detail.ID, detail.Points[0].Timestamp)
	if lat != nil || lng != nil {
		t.Fatalf("expected matched_lat/matched_lng to stay NULL without a configured matcher, got %v/%v", lat, lng)
	}
}

func TestPostgresRouteStore_ListByUserIncludesIsFavorite(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "fav3@example.com")
	detail := sampleDetail("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	detail.IsFavorite = true

	if _, err := store.Upsert(context.Background(), userID, detail); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	list, err := store.ListByUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 1 || !list[0].IsFavorite {
		t.Fatalf("expected the listed route to have IsFavorite true, got %+v", list)
	}
}
