package auth

import (
	"context"
	"time"
)

// RefreshTokenIssuer genera y persiste refresh tokens nuevos — homólogo a
// TokenIssuer para el componente con estado del par access+refresh (ver
// design.md de renovacion-token-sesion).
type RefreshTokenIssuer struct {
	Store RefreshTokenStore
	TTL   time.Duration
}

// IssueFor genera un refresh token aleatorio nuevo para userID, guarda su
// hash en Store y devuelve el valor en claro (nunca se persiste así).
func (i RefreshTokenIssuer) IssueFor(ctx context.Context, userID int64) (string, error) {
	raw, err := generateOneTimeToken()
	if err != nil {
		return "", err
	}
	if err := i.Store.Create(ctx, userID, hashOneTimeToken(raw), time.Now().Add(i.TTL)); err != nil {
		return "", err
	}
	return raw, nil
}
