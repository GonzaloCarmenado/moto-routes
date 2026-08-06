package auth

import (
	"context"
	"errors"
	"time"
)

// resetTokenTTL es cuánto tiempo es válido un token de reset de contraseña
// antes de caducar — más corto que verificationTokenTTL (24h) porque un
// token de reset da control total de la cuenta si cae en manos ajenas,
// riesgo mayor que uno de verificación de email (ver design.md).
const resetTokenTTL = time.Hour

// ErrPasswordResetTokenNotFound se devuelve cuando no existe ningún token de
// reset con el hash indicado.
var ErrPasswordResetTokenNotFound = errors.New("password reset token not found")

// StoredPasswordResetToken es un token de reset de contraseña tal y como
// vive en el almacén. UsedAt nil significa que todavía no se ha canjeado.
type StoredPasswordResetToken struct {
	ID        int64
	UserID    int64
	ExpiresAt time.Time
	UsedAt    *time.Time
}

// PasswordResetTokenStore persiste y consulta tokens de reset de contraseña
// de un solo uso. Tabla e interfaz propias, separadas de
// VerificationTokenStore: un token de reset y uno de verificación de email
// no deben ser intercambiables (ver design.md).
type PasswordResetTokenStore interface {
	// CreateToken invalida cualquier token sin usar previo del usuario y
	// almacena tokenHash como el nuevo token válido hasta expiresAt.
	CreateToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error
	// FindByHash busca el token por su hash, usado o no, expirado o no —
	// quien llama decide qué hacer con cada caso.
	FindByHash(ctx context.Context, tokenHash string) (StoredPasswordResetToken, error)
	// MarkUsed marca el token como canjeado ahora mismo.
	MarkUsed(ctx context.Context, id int64) error
}
