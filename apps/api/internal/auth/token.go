package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrInvalidToken cubre cualquier motivo por el que un token no es válido:
// firma incorrecta, formato inesperado o expiración.
var ErrInvalidToken = errors.New("invalid or expired token")

type tokenClaims struct {
	UserID int64 `json:"uid"`
	jwt.RegisteredClaims
}

// TokenIssuer emite y verifica los tokens de sesión firmados con HMAC.
type TokenIssuer struct {
	Secret []byte
	TTL    time.Duration
}

// Issue emite un token de sesión para el usuario indicado, válido durante TTL.
func (i TokenIssuer) Issue(userID int64) (string, error) {
	now := time.Now()
	claims := tokenClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(i.TTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(i.Secret)
}

// Verify comprueba la firma y la expiración de un token, devolviendo el id de
// usuario si es válido.
func (i TokenIssuer) Verify(tokenString string) (int64, error) {
	var claims tokenClaims
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return i.Secret, nil
	})
	if err != nil || !token.Valid {
		return 0, ErrInvalidToken
	}
	return claims.UserID, nil
}
