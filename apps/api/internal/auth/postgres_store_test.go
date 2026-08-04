package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

// testStore prepara un PostgresUserStore contra un PostgreSQL real (vía
// DATABASE_URL), aislado en su propio schema, aplicando el esquema y dejando
// la tabla users vacía.
func testStore(t *testing.T) PostgresUserStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_auth")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresUserStore{Pool: pool}
}

func TestPostgresUserStore_CreateAndFindRoundTrip(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected a non-zero id")
	}

	found, err := store.FindUserByEmail(ctx, "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.Email != "rider@example.com" || found.PasswordHash != "hashed-value" {
		t.Fatalf("unexpected stored user: %+v", found)
	}
}

func TestPostgresUserStore_CreateDuplicateEmailReturnsErrEmailTaken(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider@example.com", "hash-1"); err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}

	_, err := store.CreateUser(ctx, "rider@example.com", "hash-2")
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}

func TestPostgresUserStore_FindUnknownEmailReturnsErrUserNotFound(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	_, err := store.FindUserByEmail(ctx, "ghost@example.com")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}
