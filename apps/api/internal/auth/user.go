// Package auth implementa el registro, login y verificación de sesión de
// usuarios de la API.
package auth

import (
	"context"
	"errors"
)

// StoredUser es la representación de un usuario tal y como vive en el almacén.
type StoredUser struct {
	ID           int64
	Email        string
	PasswordHash string
}

// ErrEmailTaken se devuelve al intentar registrar un email ya existente.
var ErrEmailTaken = errors.New("email already registered")

// ErrUserNotFound se devuelve cuando no existe ninguna cuenta con ese email.
var ErrUserNotFound = errors.New("user not found")

// UserStore persiste y consulta cuentas de usuario.
type UserStore interface {
	CreateUser(ctx context.Context, email, passwordHash string) (StoredUser, error)
	FindUserByEmail(ctx context.Context, email string) (StoredUser, error)
	FindUserByID(ctx context.Context, id int64) (StoredUser, error)
}
