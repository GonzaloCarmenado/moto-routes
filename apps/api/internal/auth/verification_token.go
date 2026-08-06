package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

// oneTimeTokenBytes es la entropía de un token de un solo uso (256 bits) —
// suficiente para que un hash rápido (sha256) sea seguro para su búsqueda,
// sin necesitar un hash lento como bcrypt (pensado para secretos de baja
// entropía elegidos por un humano, no para esto). Compartido por los tokens
// de verificación de email y de reset de contraseña.
const oneTimeTokenBytes = 32

// generateOneTimeToken genera un token de un solo uso con crypto/rand,
// codificado en base64 URL-safe para poder ir en un enlace.
func generateOneTimeToken() (string, error) {
	buf := make([]byte, oneTimeTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// hashOneTimeToken devuelve la forma que se persiste en la base de datos:
// nunca el token en claro, para que un volcado de la tabla no permita
// confirmar cuentas ajenas ni resetear contraseñas ajenas.
func hashOneTimeToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
