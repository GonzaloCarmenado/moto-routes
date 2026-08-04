package migrate

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool conecta contra un PostgreSQL real vía DATABASE_URL. Es un test de
// integración deliberado (no un mock): el runner de migraciones solo tiene
// sentido verificado contra una base de datos real.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL no está definida; test de integración omitido")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	t.Cleanup(pool.Close)

	if _, err := pool.Exec(ctx, "DROP TABLE IF EXISTS users, schema_migrations"); err != nil {
		t.Fatalf("failed to reset test database: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DROP TABLE IF EXISTS users, schema_migrations")
	})

	return pool
}

func TestRun_AppliesPendingMigrations(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Run(ctx, pool, Migrations); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var version string
	err := pool.QueryRow(ctx, "SELECT version FROM schema_migrations").Scan(&version)
	if err != nil {
		t.Fatalf("expected schema_migrations to have a row: %v", err)
	}
	if version != "0001_create_users.sql" {
		t.Fatalf("expected version 0001_create_users.sql, got %q", version)
	}

	_, err = pool.Exec(ctx, "INSERT INTO users (email, password_hash) VALUES ($1, $2)", "rider@example.com", "hash")
	if err != nil {
		t.Fatalf("expected users table to accept a row: %v", err)
	}
}

func TestRun_IsIdempotent(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Run(ctx, pool, Migrations); err != nil {
		t.Fatalf("unexpected error on first run: %v", err)
	}
	if err := Run(ctx, pool, Migrations); err != nil {
		t.Fatalf("unexpected error on second run: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatalf("failed to count schema_migrations rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 applied migration after running twice, got %d", count)
	}
}
