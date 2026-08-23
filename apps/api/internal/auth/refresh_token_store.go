package auth

import (
	"context"
	"errors"
	"time"
)

// ErrRefreshTokenNotFound se devuelve cuando el hash indicado no corresponde
// a ningún refresh token vigente — inexistente, expirado o ya revocado, sin
// distinguir entre los tres casos (ver openspec/specs/user-auth/spec.md,
// "sin distinguir en la respuesta si el token nunca existió, expiró o fue
// revocado").
var ErrRefreshTokenNotFound = errors.New("refresh token not found")

// RefreshTokenStore persiste y consulta los refresh tokens de sesión. A
// diferencia de PasswordResetTokenStore, un usuario puede tener varios
// refresh tokens vigentes a la vez (uno por dispositivo con sesión abierta)
// — Create nunca invalida los anteriores.
type RefreshTokenStore interface {
	// Create guarda un nuevo refresh token para userID, válido hasta
	// expiresAt.
	Create(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error
	// Rotate busca un refresh token vigente (no expirado, no revocado) por
	// su hash, lo revoca y crea uno nuevo en la misma operación —
	// rotación de un solo uso. Devuelve el userID asociado, necesario para
	// emitir el access token nuevo. ErrRefreshTokenNotFound si oldTokenHash
	// no corresponde a ningún token vigente.
	Rotate(ctx context.Context, oldTokenHash string, newTokenHash string, newExpiresAt time.Time) (userID int64, err error)
	// Revoke marca como revocado el refresh token con ese hash, si existe y
	// todavía no lo estaba. Nunca falla si el hash no corresponde a ningún
	// token — logout no debe fallar visiblemente por esto.
	Revoke(ctx context.Context, tokenHash string) error
}
