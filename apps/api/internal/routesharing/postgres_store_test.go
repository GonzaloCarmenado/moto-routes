package routesharing

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testStore(t *testing.T) PostgresRouteShareStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_routesharing")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresRouteShareStore{Pool: pool}
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

func seedRoute(t *testing.T, pool *pgxpool.Pool, id string, userID int64, name string) {
	t.Helper()

	_, err := pool.Exec(context.Background(),
		`INSERT INTO routes (id, user_id, created_at, duration, total_distance, avg_speed, status, name)
		 VALUES ($1, $2, '2026-08-14T10:00:00.000Z', 100, 10, 40, 'completed', $3)`,
		id, userID, name,
	)
	if err != nil {
		t.Fatalf("failed to seed route: %v", err)
	}
}

func TestPostgresRouteShareStore_CreatePersistsPendingInvitation(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from1@example.com")
	toID := seedUser(t, store.Pool, "to1@example.com")
	routeID := "11111111-1111-1111-1111-111111111111"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta 1")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inv.Status != StatusPending {
		t.Fatalf("expected status pending, got %s", inv.Status)
	}
	if inv.RouteID != routeID || inv.FromUserID != fromID || inv.ToUserID != toID {
		t.Fatalf("unexpected invitation fields: %+v", inv)
	}
}

func TestPostgresRouteShareStore_CreateRejectsSharingWithSelf(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "self@example.com")
	routeID := "22222222-2222-2222-2222-222222222222"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta propia")

	_, err := store.Create(context.Background(), routeID, fromID, fromID)
	if !errors.Is(err, ErrCannotShareWithSelf) {
		t.Fatalf("expected ErrCannotShareWithSelf, got %v", err)
	}
}

func TestPostgresRouteShareStore_ListReceivedPendingIncludesRouteSummaryAndSender(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from2@example.com")
	toID := seedUser(t, store.Pool, "to2@example.com")
	routeID := "33333333-3333-3333-3333-333333333333"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta compartida")

	if _, err := store.Create(context.Background(), routeID, fromID, toID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	received, err := store.ListReceivedPending(context.Background(), toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(received) != 1 {
		t.Fatalf("expected 1 received invitation, got %d", len(received))
	}
	if received[0].RouteID != routeID || received[0].RouteName == nil || *received[0].RouteName != "Ruta compartida" {
		t.Fatalf("unexpected route summary: %+v", received[0])
	}
	if received[0].FromEmail != "from2@example.com" {
		t.Fatalf("expected sender email from2@example.com, got %s", received[0].FromEmail)
	}
}

func TestPostgresRouteShareStore_ListReceivedPendingExcludesNonPending(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from3@example.com")
	toID := seedUser(t, store.Pool, "to3@example.com")
	routeID := "44444444-4444-4444-4444-444444444444"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta a rechazar")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := store.MarkDeclined(context.Background(), toID, inv.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	received, err := store.ListReceivedPending(context.Background(), toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(received) != 0 {
		t.Fatalf("expected 0 pending invitations after declining, got %d", len(received))
	}
}

func TestPostgresRouteShareStore_ListSentByUserIncludesStatusAndRecipientEmail(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from4@example.com")
	toID := seedUser(t, store.Pool, "to4@example.com")
	routeID := "55555555-5555-5555-5555-555555555555"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta enviada")

	if _, err := store.Create(context.Background(), routeID, fromID, toID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sent, err := store.ListSentByUser(context.Background(), fromID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sent) != 1 {
		t.Fatalf("expected 1 sent invitation, got %d", len(sent))
	}
	if sent[0].ToEmail != "to4@example.com" || sent[0].Status != StatusPending {
		t.Fatalf("unexpected sent invitation: %+v", sent[0])
	}
}

func TestPostgresRouteShareStore_MarkAcceptedRequiresPendingAndRecipient(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from5@example.com")
	toID := seedUser(t, store.Pool, "to5@example.com")
	otherID := seedUser(t, store.Pool, "other5@example.com")
	routeID := "66666666-6666-6666-6666-666666666666"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta a aceptar")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := store.MarkAccepted(context.Background(), otherID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound for a non-recipient, got %v", err)
	}

	accepted, err := store.MarkAccepted(context.Background(), toID, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error accepting: %v", err)
	}
	if accepted.Status != StatusAccepted {
		t.Fatalf("expected status accepted, got %s", accepted.Status)
	}

	if _, err := store.MarkAccepted(context.Background(), toID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound on double-accept, got %v", err)
	}
}

func TestPostgresRouteShareStore_MarkDeclinedRequiresPendingAndRecipient(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from6@example.com")
	toID := seedUser(t, store.Pool, "to6@example.com")
	otherID := seedUser(t, store.Pool, "other6@example.com")
	routeID := "77777777-7777-7777-7777-777777777777"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta a rechazar")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := store.MarkDeclined(context.Background(), otherID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound for a non-recipient, got %v", err)
	}

	if err := store.MarkDeclined(context.Background(), toID, inv.ID); err != nil {
		t.Fatalf("unexpected error declining: %v", err)
	}

	if err := store.MarkDeclined(context.Background(), toID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound on double-decline, got %v", err)
	}
}

func TestPostgresRouteShareStore_MarkRevokedRequiresPendingAndSender(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from7@example.com")
	toID := seedUser(t, store.Pool, "to7@example.com")
	otherID := seedUser(t, store.Pool, "other7@example.com")
	routeID := "88888888-8888-8888-8888-888888888888"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta a revocar")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := store.MarkRevoked(context.Background(), otherID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound for a non-sender, got %v", err)
	}
	if err := store.MarkRevoked(context.Background(), toID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound for the recipient (not the sender), got %v", err)
	}

	if err := store.MarkRevoked(context.Background(), fromID, inv.ID); err != nil {
		t.Fatalf("unexpected error revoking: %v", err)
	}

	if err := store.MarkRevoked(context.Background(), fromID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound on double-revoke, got %v", err)
	}
}

func TestPostgresRouteShareStore_CannotAcceptAnAlreadyRevokedInvitation(t *testing.T) {
	store := testStore(t)
	fromID := seedUser(t, store.Pool, "from8@example.com")
	toID := seedUser(t, store.Pool, "to8@example.com")
	routeID := "99999999-9999-9999-9999-999999999999"
	seedRoute(t, store.Pool, routeID, fromID, "Ruta revocada antes de aceptar")

	inv, err := store.Create(context.Background(), routeID, fromID, toID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := store.MarkRevoked(context.Background(), fromID, inv.ID); err != nil {
		t.Fatalf("unexpected error revoking: %v", err)
	}

	if _, err := store.MarkAccepted(context.Background(), toID, inv.ID); !errors.Is(err, ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound accepting a revoked invitation, got %v", err)
	}
}
