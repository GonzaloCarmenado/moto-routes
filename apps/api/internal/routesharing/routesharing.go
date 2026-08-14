// Package routesharing persiste invitaciones para compartir una ruta con
// otra cuenta, y su ciclo de vida (pendiente/aceptada/rechazada/revocada).
// El clonado en sí (ruta + puntos + paradas + fotos) no vive aquí — lo
// orquesta el handler de "aceptar" reutilizando routes.Store y
// photos.PhotoStore/BlobStore, sin SQL nuevo para ese trabajo (ver
// design.md D4 de compartir-ruta).
package routesharing

import (
	"context"
	"errors"
)

// Status es el estado de una invitación a lo largo de su ciclo de vida.
type Status string

const (
	StatusPending  Status = "pending"
	StatusAccepted Status = "accepted"
	StatusDeclined Status = "declined"
	StatusRevoked  Status = "revoked"
)

// ErrCannotShareWithSelf se devuelve al intentar invitar al propio email.
var ErrCannotShareWithSelf = errors.New("cannot share a route with yourself")

// ErrInvitationNotFound cubre tanto que la invitación no exista como que
// exista pero no pertenezca al usuario indicado, o no esté en el estado
// requerido para la operación — nunca se distingue cuál de los tres casos
// es, para no revelar la existencia de una invitación ajena (ver design.md D6).
var ErrInvitationNotFound = errors.New("invitation not found")

// Invitation es una invitación de compartir, tal y como vive en el almacén.
type Invitation struct {
	ID         string
	RouteID    string
	FromUserID int64
	ToUserID   int64
	Status     Status
	CreatedAt  string
	UpdatedAt  string
}

// ReceivedInvitation es una invitación pendiente vista por su destinatario,
// con el resumen de ruta suficiente para decidir sin aceptarla primero.
type ReceivedInvitation struct {
	ID             string  `json:"id"`
	RouteID        string  `json:"route_id"`
	RouteName      *string `json:"route_name"`
	RouteCreatedAt string  `json:"route_created_at"`
	FromEmail      string  `json:"from_email"`
	CreatedAt      string  `json:"created_at"`
}

// SentInvitation es una invitación vista por quien la envió, con su estado actual.
type SentInvitation struct {
	ID             string  `json:"id"`
	RouteID        string  `json:"route_id"`
	RouteName      *string `json:"route_name"`
	RouteCreatedAt string  `json:"route_created_at"`
	ToEmail        string  `json:"to_email"`
	Status         Status  `json:"status"`
	CreatedAt      string  `json:"created_at"`
}

// Store persiste y consulta invitaciones de compartir.
type Store interface {
	// Create crea una invitación pendiente de fromUserID hacia toUserID para
	// routeID. Devuelve ErrCannotShareWithSelf si fromUserID == toUserID.
	Create(ctx context.Context, routeID string, fromUserID, toUserID int64) (Invitation, error)
	// ListReceivedPending devuelve las invitaciones pendientes recibidas por
	// el usuario, con resumen de ruta y email de quien la envió.
	ListReceivedPending(ctx context.Context, userID int64) ([]ReceivedInvitation, error)
	// ListSentByUser devuelve las invitaciones enviadas por el usuario, con
	// resumen de ruta, email actual del destinatario y estado.
	ListSentByUser(ctx context.Context, userID int64) ([]SentInvitation, error)
	// MarkAccepted marca como aceptada la invitación indicada, exigiendo que
	// esté pendiente y que userID sea su destinatario — comprobación y
	// cambio de estado atómicos (evita un doble-aceptado por una condición
	// de carrera). Devuelve la invitación ya marcada, o ErrInvitationNotFound.
	MarkAccepted(ctx context.Context, userID int64, invitationID string) (Invitation, error)
	// MarkDeclined marca como rechazada la invitación indicada, exigiendo
	// que esté pendiente y que userID sea su destinatario.
	MarkDeclined(ctx context.Context, userID int64, invitationID string) error
	// MarkRevoked marca como revocada la invitación indicada, exigiendo que
	// esté pendiente y que userID sea quien la envió.
	MarkRevoked(ctx context.Context, userID int64, invitationID string) error
}
