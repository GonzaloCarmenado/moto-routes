// Package auth implementa el registro, login y verificación de sesión de
// usuarios de la API.
package auth

import (
	"context"
	"errors"
	"regexp"
)

// StoredUser es la representación de un usuario tal y como vive en el almacén.
type StoredUser struct {
	ID            int64
	Email         string
	PasswordHash  string
	EmailVerified bool
}

// ErrEmailTaken se devuelve al intentar registrar un email ya existente.
var ErrEmailTaken = errors.New("email already registered")

// ErrUserNotFound se devuelve cuando no existe ninguna cuenta con ese email.
var ErrUserNotFound = errors.New("user not found")

// ErrInvalidEmail se devuelve cuando el email no tiene una forma válida mínima.
var ErrInvalidEmail = errors.New("email is empty or malformed")

// emailPattern exige el formato mínimo local@dominio.tld — no valida contra
// RFC 5322 completo, solo descarta cadenas vacías o claramente no-email.
var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// validateEmail comprueba que email tiene una forma mínima válida.
func validateEmail(email string) error {
	if !emailPattern.MatchString(email) {
		return ErrInvalidEmail
	}
	return nil
}

// UserStore persiste y consulta cuentas de usuario.
type UserStore interface {
	CreateUser(ctx context.Context, email, passwordHash string) (StoredUser, error)
	FindUserByEmail(ctx context.Context, email string) (StoredUser, error)
	FindUserByID(ctx context.Context, id int64) (StoredUser, error)
	// MarkEmailVerified marca la cuenta indicada como verificada. No hace
	// nada si ya lo estaba.
	MarkEmailVerified(ctx context.Context, id int64) error
	// UpdatePasswordHash sustituye el hash de contraseña de la cuenta.
	UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error
}
