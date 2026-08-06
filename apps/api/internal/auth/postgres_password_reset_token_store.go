package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresPasswordResetTokenStore implementa PasswordResetTokenStore contra
// la tabla password_reset_tokens real.
type PostgresPasswordResetTokenStore struct {
	Pool *pgxpool.Pool
}

// CreateToken invalida (marca como usado) cualquier token sin usar del
// usuario y crea el nuevo, en la misma transacción — solo el último enlace
// enviado debe funcionar.
func (s PostgresPasswordResetTokenStore) CreateToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		"UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
		userID,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		"INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// FindByHash busca el token por su hash, traduciendo "sin filas" a
// ErrPasswordResetTokenNotFound.
func (s PostgresPasswordResetTokenStore) FindByHash(ctx context.Context, tokenHash string) (StoredPasswordResetToken, error) {
	var token StoredPasswordResetToken
	err := s.Pool.QueryRow(ctx,
		"SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1",
		tokenHash,
	).Scan(&token.ID, &token.UserID, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoredPasswordResetToken{}, ErrPasswordResetTokenNotFound
		}
		return StoredPasswordResetToken{}, err
	}
	return token, nil
}

// MarkUsed marca el token como canjeado ahora mismo.
func (s PostgresPasswordResetTokenStore) MarkUsed(ctx context.Context, id int64) error {
	_, err := s.Pool.Exec(ctx, "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", id)
	return err
}
