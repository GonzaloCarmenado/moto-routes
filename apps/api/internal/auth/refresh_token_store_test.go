package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

// testRefreshTokenStore prepara un PostgresRefreshTokenStore contra un
// PostgreSQL real, aislado en su propio schema, con una cuenta ya creada
// para asociar los tokens.
func testRefreshTokenStore(t *testing.T) (PostgresRefreshTokenStore, int64) {
	t.Helper()

	pool := dbtest.Connect(t, "test_refresh_token")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	userStore := PostgresUserStore{Pool: pool}
	user, err := userStore.CreateUser(context.Background(), "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("failed to seed a user: %v", err)
	}

	return PostgresRefreshTokenStore{Pool: pool}, user.ID
}

func TestPostgresRefreshTokenStore_CreateThenRotateSucceeds(t *testing.T) {
	store, userID := testRefreshTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(time.Hour)

	if err := store.Create(ctx, userID, "hash-old", expiresAt); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}

	gotUserID, err := store.Rotate(ctx, "hash-old", "hash-new", expiresAt)
	if err != nil {
		t.Fatalf("unexpected error rotating token: %v", err)
	}
	if gotUserID != userID {
		t.Fatalf("expected userID %d, got %d", userID, gotUserID)
	}
}

func TestPostgresRefreshTokenStore_RotateInvalidatesTheOldToken(t *testing.T) {
	store, userID := testRefreshTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(time.Hour)

	if err := store.Create(ctx, userID, "hash-old", expiresAt); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}
	if _, err := store.Rotate(ctx, "hash-old", "hash-new", expiresAt); err != nil {
		t.Fatalf("unexpected error rotating token: %v", err)
	}

	if _, err := store.Rotate(ctx, "hash-old", "hash-newer", expiresAt); !errors.Is(err, ErrRefreshTokenNotFound) {
		t.Fatalf("expected ErrRefreshTokenNotFound reusing an already-rotated token, got %v", err)
	}
}

func TestPostgresRefreshTokenStore_RotateRejectsExpiredToken(t *testing.T) {
	store, userID := testRefreshTokenStore(t)
	ctx := context.Background()
	alreadyExpired := time.Now().Add(-time.Hour)

	if err := store.Create(ctx, userID, "hash-expired", alreadyExpired); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}

	if _, err := store.Rotate(ctx, "hash-expired", "hash-new", time.Now().Add(time.Hour)); !errors.Is(err, ErrRefreshTokenNotFound) {
		t.Fatalf("expected ErrRefreshTokenNotFound for an expired token, got %v", err)
	}
}

func TestPostgresRefreshTokenStore_RotateRejectsUnknownHash(t *testing.T) {
	store, _ := testRefreshTokenStore(t)
	ctx := context.Background()

	if _, err := store.Rotate(ctx, "does-not-exist", "hash-new", time.Now().Add(time.Hour)); !errors.Is(err, ErrRefreshTokenNotFound) {
		t.Fatalf("expected ErrRefreshTokenNotFound for an unknown hash, got %v", err)
	}
}

func TestPostgresRefreshTokenStore_RevokeThenRotateFails(t *testing.T) {
	store, userID := testRefreshTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(time.Hour)

	if err := store.Create(ctx, userID, "hash-1", expiresAt); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}
	if err := store.Revoke(ctx, "hash-1"); err != nil {
		t.Fatalf("unexpected error revoking token: %v", err)
	}

	if _, err := store.Rotate(ctx, "hash-1", "hash-new", expiresAt); !errors.Is(err, ErrRefreshTokenNotFound) {
		t.Fatalf("expected ErrRefreshTokenNotFound for a revoked token, got %v", err)
	}
}

func TestPostgresRefreshTokenStore_RevokeUnknownHashDoesNotFail(t *testing.T) {
	store, _ := testRefreshTokenStore(t)
	ctx := context.Background()

	if err := store.Revoke(ctx, "does-not-exist"); err != nil {
		t.Fatalf("expected Revoke to be a no-op for an unknown hash, got %v", err)
	}
}

func TestPostgresRefreshTokenStore_CreateAllowsMultipleValidTokensPerUser(t *testing.T) {
	store, userID := testRefreshTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(time.Hour)

	if err := store.Create(ctx, userID, "hash-device-a", expiresAt); err != nil {
		t.Fatalf("unexpected error creating first token: %v", err)
	}
	if err := store.Create(ctx, userID, "hash-device-b", expiresAt); err != nil {
		t.Fatalf("unexpected error creating second token: %v", err)
	}

	if _, err := store.Rotate(ctx, "hash-device-a", "hash-device-a-2", expiresAt); err != nil {
		t.Fatalf("expected the first device's token to still be valid: %v", err)
	}
	if _, err := store.Rotate(ctx, "hash-device-b", "hash-device-b-2", expiresAt); err != nil {
		t.Fatalf("expected the second device's token to still be valid: %v", err)
	}
}
