package routesharing

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRouteShareStore implementa Store contra la tabla route_shares real.
type PostgresRouteShareStore struct {
	Pool *pgxpool.Pool
}

// Create inserta una invitación pendiente. No comprueba aquí que routeID
// pertenezca a fromUserID ni que esté sincronizado — eso lo exige el
// handler antes de llamar, con acceso a routes.Store (ver design.md D2).
func (s PostgresRouteShareStore) Create(ctx context.Context, routeID string, fromUserID, toUserID int64) (Invitation, error) {
	if fromUserID == toUserID {
		return Invitation{}, ErrCannotShareWithSelf
	}

	var inv Invitation
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO route_shares (id, route_id, from_user_id, to_user_id, status)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, route_id, from_user_id, to_user_id, status, created_at::text, updated_at::text`,
		uuid.NewString(), routeID, fromUserID, toUserID, StatusPending,
	).Scan(&inv.ID, &inv.RouteID, &inv.FromUserID, &inv.ToUserID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt)
	if err != nil {
		return Invitation{}, err
	}
	return inv, nil
}

// ListReceivedPending devuelve las invitaciones pendientes recibidas por el
// usuario, con el resumen de ruta y el email de quien la envió.
func (s PostgresRouteShareStore) ListReceivedPending(ctx context.Context, userID int64) ([]ReceivedInvitation, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT rs.id, rs.route_id, r.name, r.created_at, u.email, rs.created_at::text
		 FROM route_shares rs
		 JOIN routes r ON r.id = rs.route_id
		 JOIN users u ON u.id = rs.from_user_id
		 WHERE rs.to_user_id = $1 AND rs.status = $2
		 ORDER BY rs.created_at DESC`,
		userID, StatusPending,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	received := []ReceivedInvitation{}
	for rows.Next() {
		var r ReceivedInvitation
		if err := rows.Scan(&r.ID, &r.RouteID, &r.RouteName, &r.RouteCreatedAt, &r.FromEmail, &r.CreatedAt); err != nil {
			return nil, err
		}
		received = append(received, r)
	}
	return received, rows.Err()
}

// ListSentByUser devuelve las invitaciones enviadas por el usuario, con el
// resumen de ruta, el email actual de la cuenta destinataria y el estado.
func (s PostgresRouteShareStore) ListSentByUser(ctx context.Context, userID int64) ([]SentInvitation, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT rs.id, rs.route_id, r.name, r.created_at, u.email, rs.status, rs.created_at::text
		 FROM route_shares rs
		 JOIN routes r ON r.id = rs.route_id
		 JOIN users u ON u.id = rs.to_user_id
		 WHERE rs.from_user_id = $1
		 ORDER BY rs.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sent := []SentInvitation{}
	for rows.Next() {
		var s SentInvitation
		if err := rows.Scan(&s.ID, &s.RouteID, &s.RouteName, &s.RouteCreatedAt, &s.ToEmail, &s.Status, &s.CreatedAt); err != nil {
			return nil, err
		}
		sent = append(sent, s)
	}
	return sent, rows.Err()
}

// MarkAccepted marca como aceptada la invitación indicada de forma atómica
// (UPDATE ... WHERE status = pending), para que un doble-aceptado
// concurrente solo pueda ganar una de las dos peticiones — la otra recibe
// ErrInvitationNotFound, nunca clona dos veces.
func (s PostgresRouteShareStore) MarkAccepted(ctx context.Context, userID int64, invitationID string) (Invitation, error) {
	var inv Invitation
	err := s.Pool.QueryRow(ctx,
		`UPDATE route_shares SET status = $1, updated_at = now()
		 WHERE id = $2 AND to_user_id = $3 AND status = $4
		 RETURNING id, route_id, from_user_id, to_user_id, status, created_at::text, updated_at::text`,
		StatusAccepted, invitationID, userID, StatusPending,
	).Scan(&inv.ID, &inv.RouteID, &inv.FromUserID, &inv.ToUserID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invitation{}, ErrInvitationNotFound
		}
		return Invitation{}, err
	}
	return inv, nil
}

// MarkDeclined marca como rechazada la invitación indicada, exigiendo que
// esté pendiente y que userID sea su destinatario.
func (s PostgresRouteShareStore) MarkDeclined(ctx context.Context, userID int64, invitationID string) error {
	return s.markStatus(ctx, invitationID, "to_user_id", userID, StatusDeclined)
}

// MarkRevoked marca como revocada la invitación indicada, exigiendo que
// esté pendiente y que userID sea quien la envió.
func (s PostgresRouteShareStore) MarkRevoked(ctx context.Context, userID int64, invitationID string) error {
	return s.markStatus(ctx, invitationID, "from_user_id", userID, StatusRevoked)
}

func (s PostgresRouteShareStore) markStatus(ctx context.Context, invitationID, ownerColumn string, ownerID int64, newStatus Status) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE route_shares SET status = $1, updated_at = now()
		 WHERE id = $2 AND `+ownerColumn+` = $3 AND status = $4`,
		newStatus, invitationID, ownerID, StatusPending,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrInvitationNotFound
	}
	return nil
}
