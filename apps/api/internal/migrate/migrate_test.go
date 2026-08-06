package migrate

import (
	"context"
	"io/fs"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
)

// testPool conecta contra un PostgreSQL real vía DATABASE_URL, aislado en su
// propio schema. Es un test de integración deliberado (no un mock): el
// runner de migraciones solo tiene sentido verificado contra una base de
// datos real.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return dbtest.Connect(t, "test_migrate")
}

func TestRun_AppliesPendingMigrations(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Run(ctx, pool, Migrations); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rows, err := pool.Query(ctx, "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		t.Fatalf("failed to query schema_migrations: %v", err)
	}
	var versions []string
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			t.Fatalf("failed to scan version: %v", err)
		}
		versions = append(versions, version)
	}
	rows.Close()

	if len(versions) == 0 || versions[0] != "0001_create_users.sql" {
		t.Fatalf("expected 0001_create_users.sql to be applied, got %v", versions)
	}

	_, err = pool.Exec(ctx, "INSERT INTO users (email, password_hash) VALUES ($1, $2)", "rider@example.com", "hash")
	if err != nil {
		t.Fatalf("expected users table to accept a row: %v", err)
	}
}

func TestRun_AppliesEmailVerificationMigration(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Run(ctx, pool, Migrations); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := pool.Exec(ctx, "INSERT INTO users (email, password_hash) VALUES ($1, $2)", "rider@example.com", "hash"); err != nil {
		t.Fatalf("expected users table to accept a row: %v", err)
	}

	var verified bool
	if err := pool.QueryRow(ctx, "SELECT email_verified FROM users WHERE email = $1", "rider@example.com").Scan(&verified); err != nil {
		t.Fatalf("expected users.email_verified column to exist: %v", err)
	}
	if verified {
		t.Fatal("expected email_verified to default to false")
	}

	var userID int64
	if err := pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", "rider@example.com").Scan(&userID); err != nil {
		t.Fatalf("failed to read back user id: %v", err)
	}

	_, err := pool.Exec(ctx,
		"INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
		userID, "some-hash",
	)
	if err != nil {
		t.Fatalf("expected email_verification_tokens table to accept a row: %v", err)
	}
}

func TestRun_IsIdempotent(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	entries, err := fs.ReadDir(Migrations, ".")
	if err != nil {
		t.Fatalf("failed to list embedded migrations: %v", err)
	}
	wantCount := len(entries)

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
	if count != wantCount {
		t.Fatalf("expected exactly %d applied migrations after running twice, got %d", wantCount, count)
	}
}
