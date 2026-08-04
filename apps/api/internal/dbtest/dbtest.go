// Package dbtest conecta los tests de integración de otros paquetes internos
// contra un PostgreSQL real, cada uno aislado en su propio schema — así
// paquetes distintos pueden ejecutar sus tests en paralelo (comportamiento
// por defecto de `go test ./...`) sin pisarse el esquema entre ellos.
package dbtest

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect conecta contra DATABASE_URL, aislado en el schema indicado (se
// recrea vacío antes del test y se elimina al terminar). Si DATABASE_URL no
// está definida, omite el test — son tests de integración deliberados, no
// mocks, y solo tienen sentido contra una base de datos real.
func Connect(t *testing.T, schema string) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL no está definida; test de integración omitido")
	}

	ctx := context.Background()
	resetSchema(ctx, t, dsn, schema)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("invalid DATABASE_URL: %v", err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	t.Cleanup(pool.Close)
	t.Cleanup(func() { dropSchema(context.Background(), t, dsn, schema) })

	return pool
}

func resetSchema(ctx context.Context, t *testing.T, dsn, schema string) {
	t.Helper()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	defer admin.Close()

	if _, err := admin.Exec(ctx, `DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`); err != nil {
		t.Fatalf("failed to drop test schema: %v", err)
	}
	if _, err := admin.Exec(ctx, `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatalf("failed to create test schema: %v", err)
	}
}

func dropSchema(ctx context.Context, t *testing.T, dsn, schema string) {
	t.Helper()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return
	}
	defer admin.Close()
	_, _ = admin.Exec(ctx, `DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`)
}
