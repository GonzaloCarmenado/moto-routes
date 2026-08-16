package achievements

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testStore(t *testing.T) PostgresAchievementStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_achievements")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresAchievementStore{Pool: pool}
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

// seedRoute inserta una ruta ya "sincronizada" (vive directamente en routes,
// como si el usuario ya la hubiera subido a la nube) con los valores de
// agregado que necesita cada test.
func seedRoute(t *testing.T, pool *pgxpool.Pool, id string, userID int64, createdAt string, distanceKM, durationSeconds float64) {
	t.Helper()

	_, err := pool.Exec(context.Background(),
		`INSERT INTO routes (id, user_id, created_at, duration, total_distance, avg_speed, status)
		 VALUES ($1, $2, $3, $4, $5, 40, 'completed')`,
		id, userID, createdAt, durationSeconds, distanceKM,
	)
	if err != nil {
		t.Fatalf("failed to seed route: %v", err)
	}
}

// seedAchievement inserta un logro de catálogo con un umbral controlado por
// el propio test, con una key exclusiva de test para no chocar con el
// catálogo real sembrado por la migración 0009.
func seedAchievement(t *testing.T, pool *pgxpool.Pool, key string, reqType RequirementType, threshold float64) int64 {
	t.Helper()

	var id int64
	err := pool.QueryRow(context.Background(),
		`INSERT INTO achievements (key, requirement_type, threshold, title, description, icon)
		 VALUES ($1, $2, $3, $4, 'descripcion de test', 'default') RETURNING id`,
		key, reqType, threshold, "Logro de test "+key,
	).Scan(&id)
	if err != nil {
		t.Fatalf("failed to seed achievement: %v", err)
	}
	return id
}

func TestPostgresAchievementStore_AggregatesComputesTotalsAcrossSyncedRoutes(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user1@example.com")
	seedRoute(t, store.Pool, "11111111-1111-1111-1111-111111111111", userID, "2026-08-10T10:00:00.000Z", 40, 1800)
	seedRoute(t, store.Pool, "11111111-1111-1111-1111-111111111112", userID, "2026-08-11T10:00:00.000Z", 60, 3600)

	agg, err := store.Aggregates(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if agg.TotalDistanceKM != 100 {
		t.Fatalf("expected total_distance_km 100, got %v", agg.TotalDistanceKM)
	}
	if agg.RouteCount != 2 {
		t.Fatalf("expected route_count 2, got %v", agg.RouteCount)
	}
	if agg.LongestRouteSeconds != 3600 {
		t.Fatalf("expected longest_route_seconds 3600, got %v", agg.LongestRouteSeconds)
	}
}

func TestPostgresAchievementStore_AggregatesExcludesInvalidCreatedAtOnlyFromMonth(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user2@example.com")
	seedRoute(t, store.Pool, "22222222-2222-2222-2222-222222222221", userID, "not-a-real-date", 25, 900)

	agg, err := store.Aggregates(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error with an invalid created_at row: %v", err)
	}
	if agg.TotalDistanceKM != 25 {
		t.Fatalf("expected total_distance_km to still count the row, got %v", agg.TotalDistanceKM)
	}
	if agg.RouteCount != 1 {
		t.Fatalf("expected route_count to still count the row, got %v", agg.RouteCount)
	}
	if agg.MonthDistanceKM != 0 {
		t.Fatalf("expected month_km to exclude the unparseable row, got %v", agg.MonthDistanceKM)
	}
}

func TestPostgresAchievementStore_AggregatesMonthOnlyCountsCurrentCalendarMonth(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user3@example.com")
	seedRoute(t, store.Pool, "33333333-3333-3333-3333-333333333331", userID, "2020-01-15T10:00:00.000Z", 50, 1200)

	agg, err := store.Aggregates(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if agg.TotalDistanceKM != 50 {
		t.Fatalf("expected total_distance_km 50, got %v", agg.TotalDistanceKM)
	}
	if agg.MonthDistanceKM != 0 {
		t.Fatalf("expected month_km 0 for a route from a past calendar month, got %v", agg.MonthDistanceKM)
	}
}

func TestPostgresAchievementStore_CheckAndGrantGrantsOnceAndNeverDuplicates(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user4@example.com")
	achievementID := seedAchievement(t, store.Pool, "test_total_50", RequirementTotalDistanceKM, 50)
	seedRoute(t, store.Pool, "44444444-4444-4444-4444-444444444441", userID, "2026-08-10T10:00:00.000Z", 60, 1800)

	granted, err := store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(granted) != 1 || granted[0].ID != achievementID {
		t.Fatalf("expected exactly the new achievement granted, got %+v", granted)
	}

	grantedAgain, err := store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error on second check: %v", err)
	}
	if len(grantedAgain) != 0 {
		t.Fatalf("expected no newly granted achievements on second check, got %+v", grantedAgain)
	}

	progress, err := store.ListWithProgress(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error listing progress: %v", err)
	}
	achieved := findProgress(t, progress, achievementID)
	if achieved.AchievedAt == nil {
		t.Fatalf("expected the achievement to have an achieved_at date")
	}
}

func TestPostgresAchievementStore_CheckAndGrantOnlyReturnsNewlyGrantedThisCall(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user5@example.com")
	lowThreshold := seedAchievement(t, store.Pool, "test_total_10", RequirementTotalDistanceKM, 10)
	highThreshold := seedAchievement(t, store.Pool, "test_total_100", RequirementTotalDistanceKM, 100)
	seedRoute(t, store.Pool, "55555555-5555-5555-5555-555555555551", userID, "2026-08-10T10:00:00.000Z", 20, 900)

	firstCheck, err := store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !containsAchievement(firstCheck, lowThreshold) {
		t.Fatalf("expected the low-threshold achievement on the first check, got %+v", firstCheck)
	}
	if containsAchievement(firstCheck, highThreshold) {
		t.Fatalf("expected the high-threshold achievement not yet granted on the first check, got %+v", firstCheck)
	}

	seedRoute(t, store.Pool, "55555555-5555-5555-5555-555555555552", userID, "2026-08-11T10:00:00.000Z", 90, 900)
	secondCheck, err := store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !containsAchievement(secondCheck, highThreshold) {
		t.Fatalf("expected the newly crossed high-threshold achievement, got %+v", secondCheck)
	}
	if containsAchievement(secondCheck, lowThreshold) {
		t.Fatalf("expected the already-granted low-threshold achievement not to be returned again, got %+v", secondCheck)
	}
}

func TestPostgresAchievementStore_GrantedAchievementPersistsAfterRouteDeleted(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user6@example.com")
	achievementID := seedAchievement(t, store.Pool, "test_total_30", RequirementTotalDistanceKM, 30)
	routeID := "66666666-6666-6666-6666-666666666661"
	seedRoute(t, store.Pool, routeID, userID, "2026-08-10T10:00:00.000Z", 40, 1200)

	if _, err := store.CheckAndGrant(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := store.Pool.Exec(context.Background(), "DELETE FROM routes WHERE id = $1", routeID); err != nil {
		t.Fatalf("failed to delete route: %v", err)
	}

	progress, err := store.ListWithProgress(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	achieved := findProgress(t, progress, achievementID)
	if achieved.AchievedAt == nil {
		t.Fatalf("expected the achievement to remain granted after deleting its contributing route")
	}
}

func TestPostgresAchievementStore_SingleRouteDurationNotMetByAccumulation(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "user7@example.com")
	achievementID := seedAchievement(t, store.Pool, "test_duration_3600", RequirementSingleRouteDurationSec, 3600)
	seedRoute(t, store.Pool, "77777777-7777-7777-7777-777777777771", userID, "2026-08-10T10:00:00.000Z", 10, 1800)
	seedRoute(t, store.Pool, "77777777-7777-7777-7777-777777777772", userID, "2026-08-11T10:00:00.000Z", 10, 1800)

	granted, err := store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if containsAchievement(granted, achievementID) {
		t.Fatalf("expected no achievement granted from accumulated short routes, got %+v", granted)
	}

	seedRoute(t, store.Pool, "77777777-7777-7777-7777-777777777773", userID, "2026-08-12T10:00:00.000Z", 80, 3700)
	granted, err = store.CheckAndGrant(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !containsAchievement(granted, achievementID) {
		t.Fatalf("expected the long-route achievement to be granted by a single route, got %+v", granted)
	}
}

func containsAchievement(list []Achievement, id int64) bool {
	for _, a := range list {
		if a.ID == id {
			return true
		}
	}
	return false
}

func findProgress(t *testing.T, progress []Progress, achievementID int64) Progress {
	t.Helper()
	for _, p := range progress {
		if p.Achievement.ID == achievementID {
			return p
		}
	}
	t.Fatalf("achievement %d not found in progress list", achievementID)
	return Progress{}
}
