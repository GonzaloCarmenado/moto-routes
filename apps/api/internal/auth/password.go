package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// minPasswordLength es la política mínima de complejidad exigida: longitud
// suficiente para resistir fuerza bruta, sin imponer reglas de composición
// que empujen a los usuarios a contraseñas predecibles.
const minPasswordLength = 8

// ErrWeakPassword se devuelve cuando la contraseña no cumple la política mínima.
var ErrWeakPassword = errors.New("password does not meet the minimum complexity policy")

// validatePassword aplica la política mínima de complejidad.
func validatePassword(password string) error {
	if len(password) < minPasswordLength {
		return ErrWeakPassword
	}
	return nil
}

// hashPassword produce la forma irreversible de una contraseña ya validada.
func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// verifyPassword compara una contraseña en claro contra su hash almacenado.
func verifyPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
