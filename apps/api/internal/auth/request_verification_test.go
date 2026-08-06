package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

// fakeVerificationTokenStore es un VerificationTokenStore en memoria para no
// depender de PostgreSQL en los tests de comportamiento del handler.
type fakeVerificationTokenStore struct {
	byHash map[string]StoredVerificationToken
	nextID int64
}

func newFakeVerificationTokenStore() *fakeVerificationTokenStore {
	return &fakeVerificationTokenStore{byHash: map[string]StoredVerificationToken{}}
}

func (s *fakeVerificationTokenStore) CreateToken(_ context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	for hash, token := range s.byHash {
		if token.UserID == userID && token.UsedAt == nil {
			now := time.Now()
			token.UsedAt = &now
			s.byHash[hash] = token
		}
	}
	s.nextID++
	s.byHash[tokenHash] = StoredVerificationToken{ID: s.nextID, UserID: userID, ExpiresAt: expiresAt}
	return nil
}

func (s *fakeVerificationTokenStore) FindByHash(_ context.Context, tokenHash string) (StoredVerificationToken, error) {
	token, exists := s.byHash[tokenHash]
	if !exists {
		return StoredVerificationToken{}, ErrVerificationTokenNotFound
	}
	return token, nil
}

func (s *fakeVerificationTokenStore) MarkUsed(_ context.Context, id int64) error {
	for hash, token := range s.byHash {
		if token.ID == id {
			now := time.Now()
			token.UsedAt = &now
			s.byHash[hash] = token
			return nil
		}
	}
	return ErrVerificationTokenNotFound
}

func doRequestVerification(t *testing.T, handler http.Handler, emailAddr string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": emailAddr})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/verify-email/request", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRequestVerificationHandler_ExistingUnverifiedAccountSendsEmail(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	handler := RequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com")

	rec := doRequestVerification(t, handler, "rider@example.com")

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

func TestRequestVerificationHandler_UnknownEmailRespondsGenericSuccessWithoutSendingEmail(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	handler := RequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com")

	knownRec := doRequestVerificationWithKnownAccount(t, userStore, tokenStore, sender)
	unknownRec := doRequestVerification(t, handler, "ghost@example.com")

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

// doRequestVerificationWithKnownAccount registra una cuenta nueva y solicita
// verificación para ella, para comparar la respuesta contra la de un email
// desconocido en el mismo test.
func doRequestVerificationWithKnownAccount(t *testing.T, userStore UserStore, tokenStore VerificationTokenStore, sender email.Sender) *httptest.ResponseRecorder {
	t.Helper()
	doRegister(t, userStore, "known@example.com", "correct-horse-battery")
	handler := RequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com")
	return doRequestVerification(t, handler, "known@example.com")
}

func TestRequestVerificationHandler_AlreadyVerifiedAccountDoesNotIssueANewToken(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	user, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	if err := userStore.MarkEmailVerified(context.Background(), user.ID); err != nil {
		t.Fatalf("unexpected error marking email verified: %v", err)
	}
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	handler := RequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com")

	rec := doRequestVerification(t, handler, "rider@example.com")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(sender.Sent) != 0 {
		t.Fatalf("expected no email sent for an already verified account, got %d", len(sender.Sent))
	}
	if len(tokenStore.byHash) != 0 {
		t.Fatalf("expected no token created for an already verified account, got %d", len(tokenStore.byHash))
	}
}

func TestRequestVerificationHandler_MalformedBodyIsRejected(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	handler := RequestVerificationHandler(userStore, tokenStore, sender, "https://api.example.com")

	req := httptest.NewRequest(http.MethodPost, "/api/auth/verify-email/request", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

