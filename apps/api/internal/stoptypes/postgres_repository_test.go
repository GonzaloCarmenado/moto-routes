package stoptypes

import (
	"context"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

func testRepository(t *testing.T) PostgresRepository {
	t.Helper()

	pool := dbtest.Connect(t, "test_stoptypes")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresRepository{Pool: pool}
}

func TestPostgresRepository_ListReturnsSeededCatalog(t *testing.T) {
	repo := testRepository(t)

	types, err := repo.List(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(types) == 0 {
		t.Fatal("expected the seeded catalog to be non-empty")
	}
	for _, st := range types {
		if st.Key == "" || st.Label == "" || st.Icon == "" {
			t.Fatalf("expected every stop type to have key, label and icon, got %+v", st)
		}
	}
}
