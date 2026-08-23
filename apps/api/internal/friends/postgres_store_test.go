package friends

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testStore(t *testing.T) PostgresFriendshipStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_friends")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresFriendshipStore{Pool: pool}
}

func seedUser(t *testing.T, pool *pgxpool.Pool, email, username string) int64 {
	t.Helper()

	var id int64
	err := pool.QueryRow(context.Background(),
		"INSERT INTO users (email, password_hash, username) VALUES ($1, 'hash', $2) RETURNING id", email, username,
	).Scan(&id)
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
	return id
}

func TestPostgresFriendshipStore_CreatePersistsPendingRequest(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "requester1@example.com", "requester1")
	addresseeID := seedUser(t, store.Pool, "addressee1@example.com", "addressee1")

	fr, err := store.Create(context.Background(), requesterID, addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fr.Status != StatusPending {
		t.Fatalf("expected status pending, got %s", fr.Status)
	}
	if fr.RequesterID != requesterID || fr.AddresseeID != addresseeID {
		t.Fatalf("unexpected friendship fields: %+v", fr)
	}
}

func TestPostgresFriendshipStore_CreateRejectsFriendingSelf(t *testing.T) {
	store := testStore(t)
	selfID := seedUser(t, store.Pool, "self@example.com", "selfuser")

	_, err := store.Create(context.Background(), selfID, selfID)
	if !errors.Is(err, ErrCannotFriendSelf) {
		t.Fatalf("expected ErrCannotFriendSelf, got %v", err)
	}
}

func TestPostgresFriendshipStore_CreateRejectsDuplicatePendingInEitherDirection(t *testing.T) {
	store := testStore(t)
	aID := seedUser(t, store.Pool, "a@example.com", "usera")
	bID := seedUser(t, store.Pool, "b@example.com", "userb")

	if _, err := store.Create(context.Background(), aID, bID); err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}

	_, err := store.Create(context.Background(), bID, aID)
	if !errors.Is(err, ErrAlreadyFriendsOrPending) {
		t.Fatalf("expected ErrAlreadyFriendsOrPending for the crossed request, got %v", err)
	}

	_, err = store.Create(context.Background(), aID, bID)
	if !errors.Is(err, ErrAlreadyFriendsOrPending) {
		t.Fatalf("expected ErrAlreadyFriendsOrPending for the exact duplicate, got %v", err)
	}
}

func TestPostgresFriendshipStore_CreateRejectsWhenAlreadyFriends(t *testing.T) {
	store := testStore(t)
	aID := seedUser(t, store.Pool, "a2@example.com", "usera2")
	bID := seedUser(t, store.Pool, "b2@example.com", "userb2")

	fr, err := store.Create(context.Background(), aID, bID)
	if err != nil {
		t.Fatalf("unexpected error creating request: %v", err)
	}
	if _, err := store.MarkAccepted(context.Background(), bID, fr.ID); err != nil {
		t.Fatalf("unexpected error accepting request: %v", err)
	}

	_, err = store.Create(context.Background(), aID, bID)
	if !errors.Is(err, ErrAlreadyFriendsOrPending) {
		t.Fatalf("expected ErrAlreadyFriendsOrPending, got %v", err)
	}
}

func TestPostgresFriendshipStore_ListReceivedPendingIncludesRequesterUsername(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req1@example.com", "req1")
	addresseeID := seedUser(t, store.Pool, "addr1@example.com", "addr1")

	if _, err := store.Create(context.Background(), requesterID, addresseeID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	received, err := store.ListReceivedPending(context.Background(), addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(received) != 1 || received[0].FromUsername != "req1" {
		t.Fatalf("unexpected received requests: %+v", received)
	}
}

func TestPostgresFriendshipStore_ListReceivedPendingExcludesNonPending(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req2@example.com", "req2")
	addresseeID := seedUser(t, store.Pool, "addr2@example.com", "addr2")

	fr, err := store.Create(context.Background(), requesterID, addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := store.MarkDeclined(context.Background(), addresseeID, fr.ID); err != nil {
		t.Fatalf("unexpected error declining: %v", err)
	}

	received, err := store.ListReceivedPending(context.Background(), addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(received) != 0 {
		t.Fatalf("expected 0 pending requests after declining, got %d", len(received))
	}
}

func TestPostgresFriendshipStore_ListSentIncludesAddresseeUsernameAndStatus(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req3@example.com", "req3")
	addresseeID := seedUser(t, store.Pool, "addr3@example.com", "addr3")

	if _, err := store.Create(context.Background(), requesterID, addresseeID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sent, err := store.ListSent(context.Background(), requesterID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sent) != 1 || sent[0].ToUsername != "addr3" || sent[0].Status != StatusPending {
		t.Fatalf("unexpected sent requests: %+v", sent)
	}
}

func TestPostgresFriendshipStore_MarkAcceptedRequiresPendingAndAddressee(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req4@example.com", "req4")
	addresseeID := seedUser(t, store.Pool, "addr4@example.com", "addr4")
	otherID := seedUser(t, store.Pool, "other4@example.com", "other4")

	fr, err := store.Create(context.Background(), requesterID, addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := store.MarkAccepted(context.Background(), otherID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound for a non-addressee, got %v", err)
	}

	accepted, err := store.MarkAccepted(context.Background(), addresseeID, fr.ID)
	if err != nil {
		t.Fatalf("unexpected error accepting: %v", err)
	}
	if accepted.Status != StatusAccepted {
		t.Fatalf("expected status accepted, got %s", accepted.Status)
	}

	if _, err := store.MarkAccepted(context.Background(), addresseeID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound on double-accept, got %v", err)
	}
}

func TestPostgresFriendshipStore_MarkDeclinedRequiresPendingAndAddressee(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req5@example.com", "req5")
	addresseeID := seedUser(t, store.Pool, "addr5@example.com", "addr5")
	otherID := seedUser(t, store.Pool, "other5@example.com", "other5")

	fr, err := store.Create(context.Background(), requesterID, addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := store.MarkDeclined(context.Background(), otherID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound for a non-addressee, got %v", err)
	}

	if err := store.MarkDeclined(context.Background(), addresseeID, fr.ID); err != nil {
		t.Fatalf("unexpected error declining: %v", err)
	}

	if err := store.MarkDeclined(context.Background(), addresseeID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound on double-decline, got %v", err)
	}
}

func TestPostgresFriendshipStore_MarkRevokedRequiresPendingAndRequester(t *testing.T) {
	store := testStore(t)
	requesterID := seedUser(t, store.Pool, "req6@example.com", "req6")
	addresseeID := seedUser(t, store.Pool, "addr6@example.com", "addr6")
	otherID := seedUser(t, store.Pool, "other6@example.com", "other6")

	fr, err := store.Create(context.Background(), requesterID, addresseeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := store.MarkRevoked(context.Background(), otherID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound for a non-requester, got %v", err)
	}

	if err := store.MarkRevoked(context.Background(), requesterID, fr.ID); err != nil {
		t.Fatalf("unexpected error revoking: %v", err)
	}

	if err := store.MarkRevoked(context.Background(), requesterID, fr.ID); !errors.Is(err, ErrFriendRequestNotFound) {
		t.Fatalf("expected ErrFriendRequestNotFound on double-revoke, got %v", err)
	}
}

func TestPostgresFriendshipStore_ListAcceptedIncludesFriendFromEitherDirection(t *testing.T) {
	store := testStore(t)
	aID := seedUser(t, store.Pool, "a7@example.com", "usera7")
	bID := seedUser(t, store.Pool, "b7@example.com", "userb7")
	cID := seedUser(t, store.Pool, "c7@example.com", "userc7")

	frAB, err := store.Create(context.Background(), aID, bID)
	if err != nil {
		t.Fatalf("unexpected error creating a->b: %v", err)
	}
	if _, err := store.MarkAccepted(context.Background(), bID, frAB.ID); err != nil {
		t.Fatalf("unexpected error accepting a->b: %v", err)
	}

	frCA, err := store.Create(context.Background(), cID, aID)
	if err != nil {
		t.Fatalf("unexpected error creating c->a: %v", err)
	}
	if _, err := store.MarkAccepted(context.Background(), aID, frCA.ID); err != nil {
		t.Fatalf("unexpected error accepting c->a: %v", err)
	}

	friendsOfA, err := store.ListAccepted(context.Background(), aID)
	if err != nil {
		t.Fatalf("unexpected error listing friends of a: %v", err)
	}
	if len(friendsOfA) != 2 {
		t.Fatalf("expected 2 friends for a (as requester of one, addressee of the other), got %d: %+v", len(friendsOfA), friendsOfA)
	}

	friendsOfB, err := store.ListAccepted(context.Background(), bID)
	if err != nil {
		t.Fatalf("unexpected error listing friends of b: %v", err)
	}
	if len(friendsOfB) != 1 || friendsOfB[0].Username != "usera7" {
		t.Fatalf("unexpected friends of b: %+v", friendsOfB)
	}
}

func TestPostgresFriendshipStore_ListAcceptedExcludesPending(t *testing.T) {
	store := testStore(t)
	aID := seedUser(t, store.Pool, "a8@example.com", "usera8")
	bID := seedUser(t, store.Pool, "b8@example.com", "userb8")

	if _, err := store.Create(context.Background(), aID, bID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	friendsOfA, err := store.ListAccepted(context.Background(), aID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(friendsOfA) != 0 {
		t.Fatalf("expected 0 friends while the request is still pending, got %d", len(friendsOfA))
	}
}
