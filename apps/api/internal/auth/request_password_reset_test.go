package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

// fakePasswordResetTokenStore es un PasswordResetTokenStore en memoria para
// no depender de PostgreSQL en los tests de comportamiento del handler.
type fakePasswordResetTokenStore struct {
	byHash map[string]StoredPasswordResetToken
	nextID int64
}

func newFakePasswordResetTokenStore() *fakePasswordResetTokenStore {
	return &fakePasswordResetTokenStore{byHash: map[string]StoredPasswordResetToken{}}
}

func (s *fakePasswordResetTokenStore) CreateToken(_ context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	for hash, token := range s.byHash {
		if token.UserID == userID && token.UsedAt == nil {
			now := time.Now()
			token.UsedAt = &now
			s.byHash[hash] = token
		}
	}
	s.nextID++
	s.byHash[tokenHash] = StoredPasswordResetToken{ID: s.nextID, UserID: userID, ExpiresAt: expiresAt}
	return nil
}

func (s *fakePasswordResetTokenStore) FindByHash(_ context.Context, tokenHash string) (StoredPasswordResetToken, error) {
	token, exists := s.byHash[tokenHash]
	if !exists {
		return StoredPasswordResetToken{}, ErrPasswordResetTokenNotFound
	}
	return token, nil
}

func (s *fakePasswordResetTokenStore) MarkUsed(_ context.Context, id int64) error {
	for hash, token := range s.byHash {
		if token.ID == id {
			now := time.Now()
			token.UsedAt = &now
			s.byHash[hash] = token
			return nil
		}
	}
	return ErrPasswordResetTokenNotFound
}

func doRequestPasswordReset(t *testing.T, handler http.Handler, emailAddr string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": emailAddr})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password/request", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRequestPasswordResetHandler_ExistingAccountSendsEmail(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	tokenStore := newFakePasswordResetTokenStore()
	sender := &email.FakeSender{}
	handler := RequestPasswordResetHandler(userStore, tokenStore, sender, "https://api.example.com")

	rec := doRequestPasswordReset(t, handler, "rider@example.com")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(sender.Sent) != 1 {
		t.Fatalf("expected exactly 1 email sent, got %d", len(sender.Sent))
	}
	if sender.Sent[0].To != "rider@example.com" {
		t.Fatalf("expected email sent to rider@example.com, got %s", sender.Sent[0].To)
	}
	if len(tokenStore.byHash) != 1 {
		t.Fatalf("expected exactly 1 token stored, got %d", len(tokenStore.byHash))
	}
}

func TestRequestPasswordResetHandler_UnknownEmailRespondsGenericSuccessWithoutSendingEmail(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "known@example.com", "correct-horse-battery")
	tokenStore := newFakePasswordResetTokenStore()
	sender := &email.FakeSender{}
	handler := RequestPasswordResetHandler(userStore, tokenStore, sender, "https://api.example.com")

	knownRec := doRequestPasswordReset(t, handler, "known@example.com")
	unknownRec := doRequestPasswordReset(t, handler, "ghost@example.com")

	if unknownRec.Code != knownRec.Code {
		t.Fatalf("expected the same status for unknown email as for a known one, got %d vs %d", unknownRec.Code, knownRec.Code)
	}
	if unknownRec.Body.String() != knownRec.Body.String() {
		t.Fatalf("expected identical generic response bodies, got %q vs %q", unknownRec.Body.String(), knownRec.Body.String())
	}
	if len(sender.Sent) != 1 {
		t.Fatalf("expected no email sent for the unknown address (only the known-account one), got %d sent", len(sender.Sent))
	}
}

func TestRequestPasswordResetHandler_EmailLinkContainsOnlyTheTokenNotTheEmail(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	tokenStore := newFakePasswordResetTokenStore()
	sender := &email.FakeSender{}
	handler := RequestPasswordResetHandler(userStore, tokenStore, sender, "https://api.example.com")

	doRequestPasswordReset(t, handler, "rider@example.com")

	if len(sender.Sent) != 1 {
		t.Fatalf("expected exactly 1 email sent, got %d", len(sender.Sent))
	}
	html := sender.Sent[0].HTML
	if !strings.Contains(html, "https://api.example.com/api/auth/reset-password/confirm?token=") {
		t.Fatalf("expected the email to contain a confirmation link with a token, got: %s", html)
	}
	if strings.Contains(html, "rider@example.com") {
		t.Fatalf("expected the confirmation link to never contain the account email, got: %s", html)
	}
}

func TestRequestPasswordResetHandler_MalformedBodyIsRejected(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	sender := &email.FakeSender{}
	handler := RequestPasswordResetHandler(userStore, tokenStore, sender, "https://api.example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password/request", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
