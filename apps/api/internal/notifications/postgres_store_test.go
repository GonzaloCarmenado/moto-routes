package notifications

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testStore(t *testing.T) PostgresDeviceTokenStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_notifications")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresDeviceTokenStore{Pool: pool}
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

func TestUpsert_RegistersNewToken(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "device-owner@example.com")

	if err := store.Upsert(context.Background(), userID, "token-abc", "android"); err != nil {
		t.Fatalf("Upsert failed: %v", err)
	}

	tokens, err := store.TokensForUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("TokensForUser failed: %v", err)
	}
	if len(tokens) != 1 || tokens[0] != "token-abc" {
		t.Fatalf("expected [token-abc], got %v", tokens)
	}
}

func TestUpsert_ReassignsTokenToNewUser(t *testing.T) {
	store := testStore(t)
	userA := seedUser(t, store.Pool, "user-a@example.com")
	userB := seedUser(t, store.Pool, "user-b@example.com")

	if err := store.Upsert(context.Background(), userA, "shared-device-token", "android"); err != nil {
		t.Fatalf("Upsert (A) failed: %v", err)
	}
	if err := store.Upsert(context.Background(), userB, "shared-device-token", "android"); err != nil {
		t.Fatalf("Upsert (B) failed: %v", err)
	}

	tokensA, _ := store.TokensForUser(context.Background(), userA)
	tokensB, _ := store.TokensForUser(context.Background(), userB)

	if len(tokensA) != 0 {
		t.Fatalf("expected user A to have no tokens after reassignment, got %v", tokensA)
	}
	if len(tokensB) != 1 || tokensB[0] != "shared-device-token" {
		t.Fatalf("expected user B to own the token, got %v", tokensB)
	}
}

func TestTokensForUser_EmptyWithoutAnyRegistered(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "no-tokens@example.com")

	tokens, err := store.TokensForUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("TokensForUser failed: %v", err)
	}
	if len(tokens) != 0 {
		t.Fatalf("expected no tokens, got %v", tokens)
	}
}

func TestDelete_RemovesToken(t *testing.T) {
	store := testStore(t)
	userID := seedUser(t, store.Pool, "delete-me@example.com")
	if err := store.Upsert(context.Background(), userID, "token-to-delete", "android"); err != nil {
		t.Fatalf("Upsert failed: %v", err)
	}

	if err := store.Delete(context.Background(), "token-to-delete"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	tokens, _ := store.TokensForUser(context.Background(), userID)
	if len(tokens) != 0 {
		t.Fatalf("expected token to be gone, got %v", tokens)
	}
}
