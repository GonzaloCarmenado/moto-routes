package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

// testVerificationTokenStore prepara un PostgresVerificationTokenStore contra
// un PostgreSQL real, aislado en su propio schema, con una cuenta ya creada
// para asociar los tokens.
func testVerificationTokenStore(t *testing.T) (PostgresVerificationTokenStore, int64) {
	t.Helper()

	pool := dbtest.Connect(t, "test_verification_token")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	userStore := PostgresUserStore{Pool: pool}
	user, err := userStore.CreateUser(context.Background(), "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("failed to seed a user: %v", err)
	}

	return PostgresVerificationTokenStore{Pool: pool}, user.ID
}

func TestPostgresVerificationTokenStore_CreateAndFindByHashRoundTrip(t *testing.T) {
	store, userID := testVerificationTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)

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

func TestPostgresVerificationTokenStore_CreateInvalidatesPreviousUnusedToken(t *testing.T) {
	store, userID := testVerificationTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)

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
		t.Fatal("expected the previous unused token to be invalidated (used_at set) once a new one is issued")
	}

	newToken, err := store.FindByHash(ctx, "hash-new")
	if err != nil {
		t.Fatalf("unexpected error finding new token: %v", err)
	}
	if newToken.UsedAt != nil {
		t.Fatal("expected the newly issued token to remain unused")
	}
}

func TestPostgresVerificationTokenStore_FindByUnknownHashReturnsErrVerificationTokenNotFound(t *testing.T) {
	store, _ := testVerificationTokenStore(t)
	ctx := context.Background()

	_, err := store.FindByHash(ctx, "does-not-exist")
	if !errors.Is(err, ErrVerificationTokenNotFound) {
		t.Fatalf("expected ErrVerificationTokenNotFound, got %v", err)
	}
}

func TestPostgresVerificationTokenStore_MarkUsedPersists(t *testing.T) {
	store, userID := testVerificationTokenStore(t)
	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)

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
