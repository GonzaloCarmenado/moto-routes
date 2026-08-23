package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// fakeRefreshTokenStore es un RefreshTokenStore en memoria para tests que no
// necesitan Postgres real (LoginHandler, RefreshTokenIssuer) — los tests de
// integración reales contra Postgres viven en refresh_token_store_test.go.
type fakeRefreshTokenStore struct {
	mu     sync.Mutex
	tokens map[string]fakeRefreshTokenRow
}

type fakeRefreshTokenRow struct {
	userID    int64
	expiresAt time.Time
	revoked   bool
}

func newFakeRefreshTokenStore() *fakeRefreshTokenStore {
	return &fakeRefreshTokenStore{tokens: map[string]fakeRefreshTokenRow{}}
}

func (s *fakeRefreshTokenStore) Create(_ context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[tokenHash] = fakeRefreshTokenRow{userID: userID, expiresAt: expiresAt}
	return nil
}

func (s *fakeRefreshTokenStore) Rotate(_ context.Context, oldTokenHash string, newTokenHash string, newExpiresAt time.Time) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	row, ok := s.tokens[oldTokenHash]
	if !ok || row.revoked || time.Now().After(row.expiresAt) {
		return 0, ErrRefreshTokenNotFound
	}
	row.revoked = true
	s.tokens[oldTokenHash] = row
	s.tokens[newTokenHash] = fakeRefreshTokenRow{userID: row.userID, expiresAt: newExpiresAt}
	return row.userID, nil
}

func (s *fakeRefreshTokenStore) Revoke(_ context.Context, tokenHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	row, ok := s.tokens[tokenHash]
	if !ok {
		return nil
	}
	row.revoked = true
	s.tokens[tokenHash] = row
	return nil
}

func TestRefreshTokenIssuer_IssueForGeneratesAUsableToken(t *testing.T) {
	store := newFakeRefreshTokenStore()
	issuer := RefreshTokenIssuer{Store: store, TTL: time.Hour}

	token, err := issuer.IssueFor(context.Background(), 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Fatal("expected a non-empty refresh token")
	}

	userID, err := store.Rotate(context.Background(), hashOneTimeToken(token), "next-hash", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("expected the issued token to be rotatable: %v", err)
	}
	if userID != 42 {
		t.Fatalf("expected userID 42, got %d", userID)
	}
}

func TestRefreshTokenIssuer_IssueForNeverStoresTheRawToken(t *testing.T) {
	store := newFakeRefreshTokenStore()
	issuer := RefreshTokenIssuer{Store: store, TTL: time.Hour}

	token, err := issuer.IssueFor(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := store.Rotate(context.Background(), token, "next-hash", time.Now().Add(time.Hour)); !errors.Is(err, ErrRefreshTokenNotFound) {
		t.Fatal("expected the raw token to NOT be usable as-is against the store — only its hash is stored")
	}
}
