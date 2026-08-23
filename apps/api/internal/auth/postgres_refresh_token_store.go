package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRefreshTokenStore implementa RefreshTokenStore contra la tabla
// refresh_tokens real.
type PostgresRefreshTokenStore struct {
	Pool *pgxpool.Pool
}

// Create inserta un nuevo refresh token para userID.
func (s PostgresRefreshTokenStore) Create(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := s.Pool.Exec(ctx,
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt,
	)
	return err
}

// Rotate busca oldTokenHash vigente (no expirado, no revocado), lo revoca y
// crea newTokenHash en la misma transacción — rotación de un solo uso. Usa
// SELECT ... FOR UPDATE para que dos canjes concurrentes del mismo token no
// puedan rotarlo dos veces.
func (s PostgresRefreshTokenStore) Rotate(ctx context.Context, oldTokenHash string, newTokenHash string, newExpiresAt time.Time) (int64, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var id, userID int64
	err = tx.QueryRow(ctx,
		"SELECT id, user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() FOR UPDATE",
		oldTokenHash,
	).Scan(&id, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrRefreshTokenNotFound
		}
		return 0, err
	}

	if _, err := tx.Exec(ctx, "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", id); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, newTokenHash, newExpiresAt,
	); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return userID, nil
}

// Revoke marca como revocado el refresh token con ese hash, si existe y
// todavía no lo estaba. No falla si el hash no corresponde a ningún token.
func (s PostgresRefreshTokenStore) Revoke(ctx context.Context, tokenHash string) error {
	_, err := s.Pool.Exec(ctx,
		"UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
		tokenHash,
	)
	return err
}
