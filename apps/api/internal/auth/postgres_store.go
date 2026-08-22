package auth

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// uniqueViolationCode es el código SQLSTATE de PostgreSQL para una violación
// de constraint UNIQUE (email duplicado).
const uniqueViolationCode = "23505"

// PostgresUserStore implementa UserStore contra la tabla users real.
type PostgresUserStore struct {
	Pool *pgxpool.Pool
}

// CreateUser inserta la cuenta nueva, traduciendo la violación de la
// constraint única de email o de username a ErrEmailTaken/ErrUsernameTaken
// respectivamente (distinguidas por el nombre de la constraint/índice que
// violó, ver users_email_key/users_username_lower_idx).
func (s PostgresUserStore) CreateUser(ctx context.Context, email, passwordHash, username string) (StoredUser, error) {
	var user StoredUser
	err := s.Pool.QueryRow(ctx,
		"INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, password_hash, email_verified, username",
		email, passwordHash, username,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.EmailVerified, &user.Username)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
			if pgErr.ConstraintName == "users_username_lower_idx" {
				return StoredUser{}, ErrUsernameTaken
			}
			return StoredUser{}, ErrEmailTaken
		}
		return StoredUser{}, err
	}
	return user, nil
}

// FindUserByEmail busca la cuenta por email, traduciendo "sin filas" a ErrUserNotFound.
func (s PostgresUserStore) FindUserByEmail(ctx context.Context, email string) (StoredUser, error) {
	var user StoredUser
	err := s.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, email_verified, username FROM users WHERE email = $1",
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.EmailVerified, &user.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoredUser{}, ErrUserNotFound
		}
		return StoredUser{}, err
	}
	return user, nil
}

// FindUserByID busca la cuenta por id, traduciendo "sin filas" a ErrUserNotFound.
func (s PostgresUserStore) FindUserByID(ctx context.Context, id int64) (StoredUser, error) {
	var user StoredUser
	err := s.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, email_verified, username FROM users WHERE id = $1",
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.EmailVerified, &user.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoredUser{}, ErrUserNotFound
		}
		return StoredUser{}, err
	}
	return user, nil
}

// UpdateUsername fija o cambia el username de la cuenta, traduciendo la
// violación de la constraint única a ErrUsernameTaken.
func (s PostgresUserStore) UpdateUsername(ctx context.Context, id int64, username string) error {
	_, err := s.Pool.Exec(ctx, "UPDATE users SET username = $1, updated_at = now() WHERE id = $2", username, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
			return ErrUsernameTaken
		}
		return err
	}
	return nil
}

// MarkEmailVerified marca la cuenta como verificada. Idempotente: si ya
// estaba verificada, no hace nada y no devuelve error.
func (s PostgresUserStore) MarkEmailVerified(ctx context.Context, id int64) error {
	_, err := s.Pool.Exec(ctx, "UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1", id)
	return err
}

// UpdatePasswordHash sustituye el hash de contraseña de la cuenta.
func (s PostgresUserStore) UpdatePasswordHash(ctx context.Context, id int64, passwordHash string) error {
	_, err := s.Pool.Exec(ctx, "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", passwordHash, id)
	return err
}
