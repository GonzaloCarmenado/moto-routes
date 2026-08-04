package stoptypes

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository implementa Repository contra la tabla stop_types real.
type PostgresRepository struct {
	Pool *pgxpool.Pool
}

// List devuelve el catálogo completo, ordenado por id.
func (r PostgresRepository) List(ctx context.Context) ([]StopType, error) {
	rows, err := r.Pool.Query(ctx, "SELECT id, key, label, icon FROM stop_types ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	types := []StopType{}
	for rows.Next() {
		var t StopType
		if err := rows.Scan(&t.ID, &t.Key, &t.Label, &t.Icon); err != nil {
			return nil, err
		}
		types = append(types, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return types, nil
}
