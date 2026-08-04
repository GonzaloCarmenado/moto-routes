package ping

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresService implementa Service ejecutando una consulta real contra PostgreSQL.
type PostgresService struct {
	Pool *pgxpool.Pool
}

// Ping ejecuta SELECT now() y traduce el resultado (o el fallo) a Result.
func (s PostgresService) Ping(ctx context.Context) Result {
	var databaseTime time.Time
	if err := s.Pool.QueryRow(ctx, "SELECT now()").Scan(&databaseTime); err != nil {
		return Unhealthy(err.Error())
	}
	return Healthy(databaseTime)
}
