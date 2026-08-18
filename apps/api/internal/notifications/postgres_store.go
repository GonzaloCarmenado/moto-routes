package notifications

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresDeviceTokenStore implementa DeviceTokenStore contra la tabla
// device_tokens real.
type PostgresDeviceTokenStore struct {
	Pool *pgxpool.Pool
}

// Upsert registra el token contra userID. `token` es UNIQUE en la tabla:
// ON CONFLICT reasigna user_id (un dispositivo que cambia de cuenta ya no
// debe notificar a la anterior), no duplica la fila.
func (s PostgresDeviceTokenStore) Upsert(ctx context.Context, userID int64, token, platform string) error {
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO device_tokens (user_id, token, platform)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = now()`,
		userID, token, platform,
	)
	return err
}

// TokensForUser devuelve los tokens de dispositivo activos de un usuario.
func (s PostgresDeviceTokenStore) TokensForUser(ctx context.Context, userID int64) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT token FROM device_tokens WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tokens := []string{}
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	return tokens, rows.Err()
}

// Delete elimina un token — usado cuando el envío confirma que ya no es válido.
func (s PostgresDeviceTokenStore) Delete(ctx context.Context, token string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM device_tokens WHERE token = $1`, token)
	return err
}
