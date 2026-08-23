package friends

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresFriendshipStore implementa Store contra la tabla friendships real.
type PostgresFriendshipStore struct {
	Pool *pgxpool.Pool
}

// Create inserta una solicitud pendiente, o ErrAlreadyFriendsOrPending si ya
// existe una amistad o solicitud pendiente entre ambas cuentas en cualquier
// dirección — comprobación y creación en una única sentencia atómica
// (INSERT ... WHERE NOT EXISTS), sin condición de carrera (ver design.md D3).
func (s PostgresFriendshipStore) Create(ctx context.Context, requesterID, addresseeID int64) (Friendship, error) {
	if requesterID == addresseeID {
		return Friendship{}, ErrCannotFriendSelf
	}

	var fr Friendship
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO friendships (id, requester_id, addressee_id, status)
		 SELECT $1, $2, $3, $4
		 WHERE NOT EXISTS (
		     SELECT 1 FROM friendships
		     WHERE ((requester_id = $2 AND addressee_id = $3) OR (requester_id = $3 AND addressee_id = $2))
		       AND status IN ($4, $5)
		 )
		 RETURNING id, requester_id, addressee_id, status, created_at::text, updated_at::text`,
		uuid.NewString(), requesterID, addresseeID, StatusPending, StatusAccepted,
	).Scan(&fr.ID, &fr.RequesterID, &fr.AddresseeID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Friendship{}, ErrAlreadyFriendsOrPending
		}
		return Friendship{}, err
	}
	return fr, nil
}

// ListReceivedPending devuelve las solicitudes pendientes recibidas por el
// usuario, con el username de quien las envió.
func (s PostgresFriendshipStore) ListReceivedPending(ctx context.Context, userID int64) ([]ReceivedRequest, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT f.id, u.username, f.created_at::text
		 FROM friendships f
		 JOIN users u ON u.id = f.requester_id
		 WHERE f.addressee_id = $1 AND f.status = $2
		 ORDER BY f.created_at DESC`,
		userID, StatusPending,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	received := []ReceivedRequest{}
	for rows.Next() {
		var r ReceivedRequest
		if err := rows.Scan(&r.ID, &r.FromUsername, &r.CreatedAt); err != nil {
			return nil, err
		}
		received = append(received, r)
	}
	return received, rows.Err()
}

// ListSent devuelve las solicitudes enviadas por el usuario, con el username
// actual del destinatario y el estado.
func (s PostgresFriendshipStore) ListSent(ctx context.Context, userID int64) ([]SentRequest, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT f.id, u.username, f.status, f.created_at::text
		 FROM friendships f
		 JOIN users u ON u.id = f.addressee_id
		 WHERE f.requester_id = $1
		 ORDER BY f.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sent := []SentRequest{}
	for rows.Next() {
		var s SentRequest
		if err := rows.Scan(&s.ID, &s.ToUsername, &s.Status, &s.CreatedAt); err != nil {
			return nil, err
		}
		sent = append(sent, s)
	}
	return sent, rows.Err()
}

// ListAccepted devuelve los amigos ya aceptados del usuario (en cualquiera de
// las dos direcciones), con el username de la otra cuenta.
func (s PostgresFriendshipStore) ListAccepted(ctx context.Context, userID int64) ([]Friend, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT u.username
		 FROM friendships f
		 JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
		 WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = $2
		 ORDER BY f.updated_at DESC`,
		userID, StatusAccepted,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	friends := []Friend{}
	for rows.Next() {
		var f Friend
		if err := rows.Scan(&f.Username); err != nil {
			return nil, err
		}
		friends = append(friends, f)
	}
	return friends, rows.Err()
}

// MarkAccepted marca como aceptada la solicitud indicada de forma atómica
// (UPDATE ... WHERE status = pending), mismo criterio que
// routesharing.PostgresRouteShareStore.MarkAccepted.
func (s PostgresFriendshipStore) MarkAccepted(ctx context.Context, userID int64, requestID string) (Friendship, error) {
	var fr Friendship
	err := s.Pool.QueryRow(ctx,
		`UPDATE friendships SET status = $1, updated_at = now()
		 WHERE id = $2 AND addressee_id = $3 AND status = $4
		 RETURNING id, requester_id, addressee_id, status, created_at::text, updated_at::text`,
		StatusAccepted, requestID, userID, StatusPending,
	).Scan(&fr.ID, &fr.RequesterID, &fr.AddresseeID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Friendship{}, ErrFriendRequestNotFound
		}
		return Friendship{}, err
	}
	return fr, nil
}

// MarkDeclined marca como rechazada la solicitud indicada, exigiendo que
// esté pendiente y que userID sea su destinatario.
func (s PostgresFriendshipStore) MarkDeclined(ctx context.Context, userID int64, requestID string) error {
	return s.markStatus(ctx, requestID, "addressee_id", userID, StatusDeclined)
}

// MarkRevoked marca como revocada la solicitud indicada, exigiendo que esté
// pendiente y que userID sea quien la envió.
func (s PostgresFriendshipStore) MarkRevoked(ctx context.Context, userID int64, requestID string) error {
	return s.markStatus(ctx, requestID, "requester_id", userID, StatusRevoked)
}

func (s PostgresFriendshipStore) markStatus(ctx context.Context, requestID, ownerColumn string, ownerID int64, newStatus Status) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE friendships SET status = $1, updated_at = now()
		 WHERE id = $2 AND `+ownerColumn+` = $3 AND status = $4`,
		newStatus, requestID, ownerID, StatusPending,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrFriendRequestNotFound
	}
	return nil
}
