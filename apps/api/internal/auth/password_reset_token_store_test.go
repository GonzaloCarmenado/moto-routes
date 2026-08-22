package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

// testPasswordResetTokenStore prepara un PostgresPasswordResetTokenStore
// contra un PostgreSQL real, aislado en su propio schema, con una cuenta ya
// creada para asociar los tokens.
func testPasswordResetTokenStore(t *testing.T) (PostgresPasswordResetTokenStore, int64) {
	t.Helper()

	pool := dbtest.Connect(t, "test_password_reset_token")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	userStore := PostgresUserStore{Pool: pool}
	user, err := userStore.CreateUser(context.Background(), "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("failed to seed a user: %v", err)
	}

	return PostgresPasswordResetTokenStore{Pool: pool}, user.ID
}

func TestPostgresPasswordResetTokenStore_CreateAndFindByHashRoundTrip(t *testing.T) {
	store, userID := testPasswordResetTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(resetTokenTTL)

	if err := store.CreateToken(ctx, userID, "hash-1", expiresAt); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}

	found, err := store.FindByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("unexpected error finding token: %v", err)
	}
	if found.UserID != userID {
		t.Fatalf("expected UserID %d, got %d", userID, found.UserID)
	}
	if found.UsedAt != nil {
		t.Fatal("expected a freshly created token to be unused")
	}
}

func TestPostgresPasswordResetTokenStore_CreateInvalidatesPreviousUnusedToken(t *testing.T) {
	store, userID := testPasswordResetTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(resetTokenTTL)

	if err := store.CreateToken(ctx, userID, "hash-old", expiresAt); err != nil {
		t.Fatalf("unexpected error creating first token: %v", err)
	}
	if err := store.CreateToken(ctx, userID, "hash-new", expiresAt); err != nil {
		t.Fatalf("unexpected error creating second token: %v", err)
	}

	oldToken, err := store.FindByHash(ctx, "hash-old")
	if err != nil {
		t.Fatalf("unexpected error finding old token: %v", err)
	}
	if oldToken.UsedAt == nil {
		t.Fatal("expected the previous unused token to be invalidated once a new one is issued")
	}
}

func TestPostgresPasswordResetTokenStore_FindByUnknownHashReturnsErrPasswordResetTokenNotFound(t *testing.T) {
	store, _ := testPasswordResetTokenStore(t)
	ctx := context.Background()

	_, err := store.FindByHash(ctx, "does-not-exist")
	if !errors.Is(err, ErrPasswordResetTokenNotFound) {
		t.Fatalf("expected ErrPasswordResetTokenNotFound, got %v", err)
	}
}

func TestPostgresPasswordResetTokenStore_MarkUsedPersists(t *testing.T) {
	store, userID := testPasswordResetTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(resetTokenTTL)

	if err := store.CreateToken(ctx, userID, "hash-1", expiresAt); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}
	created, err := store.FindByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("unexpected error finding token: %v", err)
	}

	if err := store.MarkUsed(ctx, created.ID); err != nil {
		t.Fatalf("unexpected error marking token used: %v", err)
	}

	found, err := store.FindByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("unexpected error finding token after marking used: %v", err)
	}
	if found.UsedAt == nil {
		t.Fatal("expected UsedAt to be set after MarkUsed")
	}
}

func TestPostgresPasswordResetTokenStore_FindByHashReturnsExpiredTokensToo(t *testing.T) {
	store, userID := testPasswordResetTokenStore(t)
	ctx := context.Background()
	alreadyExpired := time.Now().Add(-time.Hour)

	if err := store.CreateToken(ctx, userID, "hash-expired", alreadyExpired); err != nil {
		t.Fatalf("unexpected error creating token: %v", err)
	}

	found, err := store.FindByHash(ctx, "hash-expired")
	if err != nil {
		t.Fatalf("expected the store to return an expired token, not hide it: %v", err)
	}
	if !found.ExpiresAt.Before(time.Now()) {
		t.Fatal("expected ExpiresAt to reflect the already-past expiration")
	}
}
