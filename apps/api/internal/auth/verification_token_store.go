package auth

import (
	"context"
	"errors"
	"time"
)

// ErrVerificationTokenNotFound se devuelve cuando no existe ningún token con
// el hash indicado.
var ErrVerificationTokenNotFound = errors.New("verification token not found")

// StoredVerificationToken es un token de verificación de email tal y como
// vive en el almacén. UsedAt nil significa que todavía no se ha canjeado.
type StoredVerificationToken struct {
	ID        int64
	UserID    int64
	ExpiresAt time.Time
	UsedAt    *time.Time
}

// VerificationTokenStore persiste y consulta tokens de verificación de email
// de un solo uso.
type VerificationTokenStore interface {
	// CreateToken invalida cualquier token sin usar previo del usuario y
	// almacena tokenHash como el nuevo token válido hasta expiresAt.
	CreateToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error
	// FindByHash busca el token por su hash, usado o no, para que quien
	// llama pueda distinguir "ya usado" de "no existe".
	FindByHash(ctx context.Context, tokenHash string) (StoredVerificationToken, error)
	// MarkUsed marca el token como canjeado ahora mismo.
	MarkUsed(ctx context.Context, id int64) error
}
