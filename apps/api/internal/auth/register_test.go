package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

// fakeUserStore es un UserStore en memoria para no depender de PostgreSQL en
// los tests de comportamiento del handler.
type fakeUserStore struct {
	byEmail    map[string]StoredUser
	byUsername map[string]int64
	nextID     int64
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{byEmail: map[string]StoredUser{}, byUsername: map[string]int64{}}
}

func (s *fakeUserStore) CreateUser(_ context.Context, email, passwordHash, username string) (StoredUser, error) {
	if _, exists := s.byEmail[email]; exists {
		return StoredUser{}, ErrEmailTaken
	}
	if _, exists := s.byUsername[username]; exists {
		return StoredUser{}, ErrUsernameTaken
	}
	s.nextID++
	user := StoredUser{ID: s.nextID, Email: email, PasswordHash: passwordHash, Username: &username}
	s.byEmail[email] = user
	s.byUsername[username] = s.nextID
	return user, nil
}

func (s *fakeUserStore) UpdateUsername(_ context.Context, id int64, username string) error {
	if existingID, exists := s.byUsername[username]; exists && existingID != id {
		return ErrUsernameTaken
	}
	for email, user := range s.byEmail {
		if user.ID == id {
			if user.Username != nil {
				delete(s.byUsername, *user.Username)
			}
			user.Username = &username
			s.byEmail[email] = user
			s.byUsername[username] = id
			return nil
		}
	}
	return ErrUserNotFound
}

func (s *fakeUserStore) FindUserByEmail(_ context.Context, email string) (StoredUser, error) {
	user, exists := s.byEmail[email]
	if !exists {
		return StoredUser{}, ErrUserNotFound
	}
	return user, nil
}

func (s *fakeUserStore) FindUserByID(_ context.Context, id int64) (StoredUser, error) {
	for _, user := range s.byEmail {
		if user.ID == id {
			return user, nil
		}
	}
	return StoredUser{}, ErrUserNotFound
}

func (s *fakeUserStore) MarkEmailVerified(_ context.Context, id int64) error {
	for email, user := range s.byEmail {
		if user.ID == id {
			user.EmailVerified = true
			s.byEmail[email] = user
			return nil
		}
	}
	return ErrUserNotFound
}

func (s *fakeUserStore) UpdatePasswordHash(_ context.Context, id int64, passwordHash string) error {
	for email, user := range s.byEmail {
		if user.ID == id {
			user.PasswordHash = passwordHash
			s.byEmail[email] = user
			return nil
		}
	}
	return ErrUserNotFound
}

// testUsernameSeq genera un username válido y distinto en cada llamada, para
// que los tests existentes (centrados en email/contraseña) no tengan que
// elegir uno a mano — ver nombre-usuario, tasks.md Grupo 2.
var testUsernameSeq int

func nextTestUsername() string {
	testUsernameSeq++
	return fmt.Sprintf("testuser%d", testUsernameSeq)
}

func doRegisterVia(t *testing.T, handler http.Handler, emailAddr, password string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": emailAddr, "password": password, "username": nextTestUsername()})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

// doRegister registra con un VerificationTokenStore/Sender desechables — los
// tests que no les prestan atención (la mayoría, centrados en el propio
// registro) no necesitan construirlos a mano.
func doRegister(t *testing.T, store UserStore, emailAddr, password string) *httptest.ResponseRecorder {
	t.Helper()
	handler := RegisterHandler(store, newFakeVerificationTokenStore(), &email.FakeSender{}, "https://api.example.com")
	return doRegisterVia(t, handler, emailAddr, password)
}

func TestRegisterHandler_ValidDataCreatesAccountWithoutPasswordInResponse(t *testing.T) {
	store := newFakeUserStore()

	rec := doRegister(t, store, "rider@example.com", "correct-horse-battery")

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(strings.ToLower(rec.Body.String()), "password") {
		t.Fatalf("response body must never include the password field: %s", rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["email"] != "rider@example.com" {
		t.Fatalf("expected email in response, got %v", body["email"])
	}

	stored, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("expected user to be persisted: %v", err)
	}
	if stored.PasswordHash == "correct-horse-battery" {
		t.Fatal("expected password to be hashed before storing, found plaintext")
	}
}

func TestRegisterHandler_DuplicateEmailIsRejectedWithoutCreatingASecondAccount(t *testing.T) {
	store := newFakeUserStore()
	doRegister(t, store, "rider@example.com", "correct-horse-battery")

	rec := doRegister(t, store, "rider@example.com", "another-valid-pass")

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 1 {
		t.Fatalf("expected exactly 1 stored account, got %d", len(store.byEmail))
	}
}

func TestRegisterHandler_EmptyEmailIsRejectedWithoutCreatingAnAccount(t *testing.T) {
	store := newFakeUserStore()

	rec := doRegister(t, store, "", "correct-horse-battery")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 0 {
		t.Fatalf("expected no account to be created, got %d", len(store.byEmail))
	}
}

func TestRegisterHandler_MalformedEmailIsRejectedWithoutCreatingAnAccount(t *testing.T) {
	store := newFakeUserStore()

	rec := doRegister(t, store, "not-an-email", "correct-horse-battery")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 0 {
		t.Fatalf("expected no account to be created, got %d", len(store.byEmail))
	}
}

func TestRegisterHandler_WeakPasswordIsRejectedWithoutCreatingAnAccount(t *testing.T) {
	store := newFakeUserStore()

	rec := doRegister(t, store, "rider@example.com", "short")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 0 {
		t.Fatalf("expected no account to be created, got %d", len(store.byEmail))
	}
}

// doRegisterWithUsername, a diferencia de doRegister, permite fijar el
// username a mano en vez de generar uno válido con nextTestUsername() —
// necesario para probar el propio rechazo por username inválido/duplicado.
func doRegisterWithUsername(t *testing.T, store UserStore, emailAddr, password, username string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": emailAddr, "password": password, "username": username})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	handler := RegisterHandler(store, newFakeVerificationTokenStore(), &email.FakeSender{}, "https://api.example.com")
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRegisterHandler_UsernameAlreadyTakenIsRejectedWithoutCreatingASecondAccount(t *testing.T) {
	store := newFakeUserStore()
	doRegisterWithUsername(t, store, "first@example.com", "correct-horse-battery", "takenname")

	rec := doRegisterWithUsername(t, store, "second@example.com", "correct-horse-battery", "takenname")

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 1 {
		t.Fatalf("expected exactly 1 stored account, got %d", len(store.byEmail))
	}
}

func TestRegisterHandler_InvalidUsernameFormatIsRejectedWithoutCreatingAnAccount(t *testing.T) {
	store := newFakeUserStore()

	rec := doRegisterWithUsername(t, store, "rider@example.com", "correct-horse-battery", "AB")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.byEmail) != 0 {
		t.Fatalf("expected no account to be created, got %d", len(store.byEmail))
	}
}

func TestRegisterHandler_ValidDataStartsWithEmailUnverifiedAndSendsVerificationEmail(t *testing.T) {
	store := newFakeUserStore()
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{}
	handler := RegisterHandler(store, tokenStore, sender, "https://api.example.com")

	rec := doRegisterVia(t, handler, "rider@example.com", "correct-horse-battery")

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}
	stored, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if stored.EmailVerified {
		t.Fatal("expected a freshly registered account to start unverified")
	}
	if len(sender.Sent) != 1 {
		t.Fatalf("expected exactly 1 verification email sent, got %d", len(sender.Sent))
	}
	if sender.Sent[0].To != "rider@example.com" {
		t.Fatalf("expected the verification email sent to rider@example.com, got %s", sender.Sent[0].To)
	}
	if len(tokenStore.byHash) != 1 {
		t.Fatalf("expected exactly 1 verification token stored, got %d", len(tokenStore.byHash))
	}
}

func TestRegisterHandler_EmailSendFailureDoesNotBlockAccountCreation(t *testing.T) {
	store := newFakeUserStore()
	tokenStore := newFakeVerificationTokenStore()
	sender := &email.FakeSender{FailWith: email.ErrFakeSendFailure}
	handler := RegisterHandler(store, tokenStore, sender, "https://api.example.com")

	rec := doRegisterVia(t, handler, "rider@example.com", "correct-horse-battery")

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201 even when the verification email fails to send, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := store.FindUserByEmail(context.Background(), "rider@example.com"); err != nil {
		t.Fatalf("expected the account to be created despite the email send failure: %v", err)
	}
}
