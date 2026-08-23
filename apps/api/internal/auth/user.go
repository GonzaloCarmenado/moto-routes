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
	// Username es nil mientras la cuenta no lo ha fijado todavía (ver
	// nombre-usuario, design.md Decisión 1 — nunca NOT NULL a nivel de BD).
	Username *string
}

// ErrEmailTaken se devuelve al intentar registrar un email ya existente.
var ErrEmailTaken = errors.New("email already registered")

// ErrUserNotFound se devuelve cuando no existe ninguna cuenta con ese email.
var ErrUserNotFound = errors.New("user not found")

// ErrInvalidEmail se devuelve cuando el email no tiene una forma válida mínima.
var ErrInvalidEmail = errors.New("email is empty or malformed")

// ErrUsernameTaken se devuelve al intentar fijar un username que ya usa otra cuenta.
var ErrUsernameTaken = errors.New("username already taken")

// ErrInvalidUsername se devuelve cuando el username no cumple el formato permitido.
var ErrInvalidUsername = errors.New("username must be 3-20 characters: lowercase letters, digits and underscore")

// emailPattern exige el formato mínimo local@dominio.tld — no valida contra
// RFC 5322 completo, solo descarta cadenas vacías o claramente no-email.
var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// usernamePattern exige minúsculas, dígitos y guion bajo, 3-20 caracteres
// (ver nombre-usuario, design.md Decisión 6).
var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

// validateEmail comprueba que email tiene una forma mínima válida.
func validateEmail(email string) error {
	if !emailPattern.MatchString(email) {
		return ErrInvalidEmail
	}
	return nil
}

// validateUsername comprueba que username cumple el formato permitido.
func validateUsername(username string) error {
	if !usernamePattern.MatchString(username) {
		return ErrInvalidUsername
	}
	return nil
}

// UserStore persiste y consulta cuentas de usuario.
type UserStore interface {
	CreateUser(ctx context.Context, email, passwordHash, username string) (StoredUser, error)
	FindUserByEmail(ctx context.Context, email string) (StoredUser, error)
	FindUserByID(ctx context.Context, id int64) (StoredUser, error)
	// FindUserByUsername busca la cuenta por username, comparando sin
	// distinguir mayúsculas/minúsculas (mismo criterio que el índice único
	// de unicidad, ver 0012_add_users_username.sql).
	FindUserByUsername(ctx context.Context, username string) (StoredUser, error)
	// MarkEmailVerified marca la cuenta indicada como verificada. No hace
	// nada si ya lo estaba.
	MarkEmailVerified(ctx context.Context, id int64) error
	// UpdatePasswordHash sustituye el hash de contraseña de la cuenta.
	UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error
	// UpdateUsername fija o cambia el username de la cuenta indicada — misma
	// operación tanto si la cuenta no tenía username todavía como si ya
	// tenía otro (ver nombre-usuario, design.md Decisión 2).
	UpdateUsername(ctx context.Context, id int64, username string) error
}
