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
// constraint única de email a ErrEmailTaken.
func (s PostgresUserStore) CreateUser(ctx context.Context, email, passwordHash string) (StoredUser, error) {
	var user StoredUser
	err := s.Pool.QueryRow(ctx,
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash",
		email, passwordHash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
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
		"SELECT id, email, password_hash FROM users WHERE email = $1",
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
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
		"SELECT id, email, password_hash FROM users WHERE id = $1",
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoredUser{}, ErrUserNotFound
		}
		return StoredUser{}, err
	}
	return user, nil
}
