package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/dbtest"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
)

// testStore prepara un PostgresUserStore contra un PostgreSQL real (vía
// DATABASE_URL), aislado en su propio schema, aplicando el esquema y dejando
// la tabla users vacía.
func testStore(t *testing.T) PostgresUserStore {
	t.Helper()

	pool := dbtest.Connect(t, "test_auth")
	if err := migrate.Run(context.Background(), pool, migrate.Migrations); err != nil {
		t.Fatalf("failed to apply migrations: %v", err)
	}

	return PostgresUserStore{Pool: pool}
}

func TestPostgresUserStore_CreateAndFindRoundTrip(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}
	if created.ID == 0 {
		t.Fatal("expected a non-zero id")
	}
	if created.Username == nil || *created.Username != "rider1" {
		t.Fatalf("expected username rider1, got %+v", created.Username)
	}

	found, err := store.FindUserByEmail(ctx, "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.Email != "rider@example.com" || found.PasswordHash != "hashed-value" {
		t.Fatalf("unexpected stored user: %+v", found)
	}
}

func TestPostgresUserStore_CreateDuplicateEmailReturnsErrEmailTaken(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider@example.com", "hash-1", "rider1"); err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}

	_, err := store.CreateUser(ctx, "rider@example.com", "hash-2", "rider2")
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}

func TestPostgresUserStore_CreateDuplicateUsernameReturnsErrUsernameTaken(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider1@example.com", "hash-1", "rider1"); err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}

	_, err := store.CreateUser(ctx, "rider2@example.com", "hash-2", "rider1")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got %v", err)
	}
}

func TestPostgresUserStore_CreateDuplicateUsernameIsCaseInsensitive(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider1@example.com", "hash-1", "rider1"); err != nil {
		t.Fatalf("unexpected error on first create: %v", err)
	}

	_, err := store.CreateUser(ctx, "rider2@example.com", "hash-2", "RIDER1")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken for a case-insensitive duplicate, got %v", err)
	}
}

func TestPostgresUserStore_UpdateUsernameSetsAndChangesIt(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	if err := store.UpdateUsername(ctx, created.ID, "newname"); err != nil {
		t.Fatalf("unexpected error updating username: %v", err)
	}

	found, err := store.FindUserByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.Username == nil || *found.Username != "newname" {
		t.Fatalf("expected username newname, got %+v", found.Username)
	}
}

func TestPostgresUserStore_UpdateUsernameToTakenReturnsErrUsernameTaken(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider1@example.com", "hash-1", "rider1"); err != nil {
		t.Fatalf("unexpected error creating first user: %v", err)
	}
	second, err := store.CreateUser(ctx, "rider2@example.com", "hash-2", "rider2")
	if err != nil {
		t.Fatalf("unexpected error creating second user: %v", err)
	}

	err = store.UpdateUsername(ctx, second.ID, "rider1")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got %v", err)
	}
}

func TestPostgresUserStore_FindUnknownEmailReturnsErrUserNotFound(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	_, err := store.FindUserByEmail(ctx, "ghost@example.com")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestPostgresUserStore_NewAccountStartsWithEmailUnverified(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}
	if created.EmailVerified {
		t.Fatal("expected a new account to start with EmailVerified false")
	}

	found, err := store.FindUserByEmail(ctx, "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.EmailVerified {
		t.Fatal("expected FindUserByEmail to report EmailVerified false")
	}
}

func TestPostgresUserStore_MarkEmailVerifiedPersists(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	if err := store.MarkEmailVerified(ctx, created.ID); err != nil {
		t.Fatalf("unexpected error marking email verified: %v", err)
	}

	byEmail, err := store.FindUserByEmail(ctx, "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error finding user by email: %v", err)
	}
	if !byEmail.EmailVerified {
		t.Fatal("expected FindUserByEmail to report EmailVerified true after marking it")
	}

	byID, err := store.FindUserByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("unexpected error finding user by id: %v", err)
	}
	if !byID.EmailVerified {
		t.Fatal("expected FindUserByID to report EmailVerified true after marking it")
	}
}

func TestPostgresUserStore_FindUserByUsernameRoundTrip(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	found, err := store.FindUserByUsername(ctx, "rider1")
	if err != nil {
		t.Fatalf("unexpected error finding user by username: %v", err)
	}
	if found.ID != created.ID || found.Email != "rider@example.com" {
		t.Fatalf("unexpected stored user: %+v", found)
	}
}

func TestPostgresUserStore_FindUserByUsernameIsCaseInsensitive(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	created, err := store.CreateUser(ctx, "rider@example.com", "hashed-value", "rider1")
	if err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	found, err := store.FindUserByUsername(ctx, "RIDER1")
	if err != nil {
		t.Fatalf("unexpected error finding user by username case-insensitively: %v", err)
	}
	if found.ID != created.ID {
		t.Fatalf("expected to find user %d, got %d", created.ID, found.ID)
	}
}

func TestPostgresUserStore_FindUnknownUsernameReturnsErrUserNotFound(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	_, err := store.FindUserByUsername(ctx, "ghost")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestPostgresUserStore_SearchUsernamesMatchesPartialCaseInsensitive(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider1@example.com", "hash-1", "rider_alpha"); err != nil {
		t.Fatalf("unexpected error creating first user: %v", err)
	}
	if _, err := store.CreateUser(ctx, "rider2@example.com", "hash-2", "RIDER_beta"); err != nil {
		t.Fatalf("unexpected error creating second user: %v", err)
	}
	if _, err := store.CreateUser(ctx, "other@example.com", "hash-3", "someoneelse"); err != nil {
		t.Fatalf("unexpected error creating third user: %v", err)
	}

	found, err := store.SearchUsernames(ctx, "RIDER", 10)
	if err != nil {
		t.Fatalf("unexpected error searching usernames: %v", err)
	}
	if len(found) != 2 || found[0] != "rider_alpha" || found[1] != "RIDER_beta" {
		t.Fatalf("expected [rider_alpha RIDER_beta] in alphabetical order, got %+v", found)
	}
}

func TestPostgresUserStore_SearchUsernamesRespectsLimit(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	for _, username := range []string{"rider_a", "rider_b", "rider_c"} {
		if _, err := store.CreateUser(ctx, username+"@example.com", "hash", username); err != nil {
			t.Fatalf("unexpected error creating user %s: %v", username, err)
		}
	}

	found, err := store.SearchUsernames(ctx, "rider", 2)
	if err != nil {
		t.Fatalf("unexpected error searching usernames: %v", err)
	}
	if len(found) != 2 {
		t.Fatalf("expected 2 results respecting the limit, got %d: %+v", len(found), found)
	}
	if found[0] != "rider_a" || found[1] != "rider_b" {
		t.Fatalf("expected [rider_a rider_b] in alphabetical order, got %+v", found)
	}
}

func TestPostgresUserStore_SearchUsernamesNoMatchReturnsEmpty(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	if _, err := store.CreateUser(ctx, "rider@example.com", "hash", "rider1"); err != nil {
		t.Fatalf("unexpected error creating user: %v", err)
	}

	found, err := store.SearchUsernames(ctx, "ghost", 10)
	if err != nil {
		t.Fatalf("unexpected error searching usernames: %v", err)
	}
	if len(found) != 0 {
		t.Fatalf("expected no matches, got %+v", found)
	}
}
