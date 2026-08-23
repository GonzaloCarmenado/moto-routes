// Package friends persiste solicitudes de amistad entre cuentas,
// identificadas por username, y su ciclo de vida
// (pendiente/aceptada/rechazada/revocada) — mismo patrón que
// internal/routesharing, sin ningún dato adicional que clonar al aceptar
// (ver design.md de agregar-amigos, D2).
package friends

import (
	"context"
	"errors"
)

// Status es el estado de una solicitud de amistad a lo largo de su ciclo de vida.
type Status string

const (
	StatusPending  Status = "pending"
	StatusAccepted Status = "accepted"
	StatusDeclined Status = "declined"
	StatusRevoked  Status = "revoked"
)

// ErrCannotFriendSelf se devuelve al intentar enviarse una solicitud a uno mismo.
var ErrCannotFriendSelf = errors.New("cannot send a friend request to yourself")

// ErrAlreadyFriendsOrPending se devuelve cuando ya existe una amistad
// aceptada o una solicitud pendiente entre las dos cuentas, en cualquier
// dirección (ver design.md D3 — nunca crea una fila nueva en ese caso).
var ErrAlreadyFriendsOrPending = errors.New("already friends or a pending request already exists between these accounts")

// ErrFriendRequestNotFound cubre tanto que la solicitud no exista como que
// exista pero no pertenezca al usuario indicado, o no esté en el estado
// requerido para la operación — nunca se distingue cuál de los tres casos
// es, mismo criterio que routesharing.ErrInvitationNotFound.
var ErrFriendRequestNotFound = errors.New("friend request not found")

// Friendship es una solicitud/relación de amistad tal y como vive en el almacén.
type Friendship struct {
	ID          string
	RequesterID int64
	AddresseeID int64
	Status      Status
	CreatedAt   string
	UpdatedAt   string
}

// ReceivedRequest es una solicitud pendiente vista por su destinatario.
type ReceivedRequest struct {
	ID           string `json:"id"`
	FromUsername string `json:"from_username"`
	CreatedAt    string `json:"created_at"`
}

// SentRequest es una solicitud vista por quien la envió, con su estado actual.
type SentRequest struct {
	ID         string `json:"id"`
	ToUsername string `json:"to_username"`
	Status     Status `json:"status"`
	CreatedAt  string `json:"created_at"`
}

// Friend es un amigo ya aceptado, identificado por su username.
type Friend struct {
	Username string `json:"username"`
}

// Store persiste y consulta solicitudes y relaciones de amistad.
type Store interface {
	// Create crea una solicitud pendiente de requesterID hacia addresseeID.
	// Devuelve ErrCannotFriendSelf si requesterID == addresseeID, o
	// ErrAlreadyFriendsOrPending si ya existe una amistad o solicitud
	// pendiente entre ambos en cualquier dirección — comprobación y
	// creación atómicas (sin condición de carrera).
	Create(ctx context.Context, requesterID, addresseeID int64) (Friendship, error)
	// ListReceivedPending devuelve las solicitudes pendientes recibidas por
	// el usuario, con el username de quien las envió.
	ListReceivedPending(ctx context.Context, userID int64) ([]ReceivedRequest, error)
	// ListSent devuelve las solicitudes enviadas por el usuario, con el
	// username actual del destinatario y el estado.
	ListSent(ctx context.Context, userID int64) ([]SentRequest, error)
	// ListAccepted devuelve los amigos ya aceptados del usuario (solicitudes
	// aceptadas en cualquiera de las dos direcciones), con su username.
	ListAccepted(ctx context.Context, userID int64) ([]Friend, error)
	// MarkAccepted marca como aceptada la solicitud indicada, exigiendo que
	// esté pendiente y que userID sea su destinatario — comprobación y
	// cambio de estado atómicos. Devuelve la solicitud ya marcada, o
	// ErrFriendRequestNotFound.
	MarkAccepted(ctx context.Context, userID int64, requestID string) (Friendship, error)
	// MarkDeclined marca como rechazada la solicitud indicada, exigiendo que
	// esté pendiente y que userID sea su destinatario.
	MarkDeclined(ctx context.Context, userID int64, requestID string) error
	// MarkRevoked marca como revocada la solicitud indicada, exigiendo que
	// esté pendiente y que userID sea quien la envió.
	MarkRevoked(ctx context.Context, userID int64, requestID string) error
}
