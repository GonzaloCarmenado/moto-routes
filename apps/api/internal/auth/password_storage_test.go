package auth

import (
	"context"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// TestRegisterThenPersist_StoredPasswordIsNeverThePlaintext es una regresión
// explícita del requisito de api-security: el valor almacenado no coincide
// con el texto enviado ni permite recuperarlo, verificado contra PostgreSQL real.
func TestRegisterThenPersist_StoredPasswordIsNeverThePlaintext(t *testing.T) {
	store := testStore(t)
	rec := doRegister(t, store, "rider@example.com", "correct-horse-battery")
	if rec.Code != 201 {
		t.Fatalf("expected registration to succeed, got %d: %s", rec.Code, rec.Body.String())
	}

	stored, err := store.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("failed to look up stored user: %v", err)
	}

	if stored.PasswordHash == "correct-horse-battery" {
		t.Fatal("stored password must not equal the plaintext sent at registration")
	}
	if strings.Contains(stored.PasswordHash, "correct-horse-battery") {
		t.Fatal("stored hash must not contain the plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("correct-horse-battery")); err != nil {
		t.Fatalf("expected the stored hash to verify against the original password: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte(stored.PasswordHash)); err == nil {
		t.Fatal("the stored hash must not itself be usable as the password (i.e. it is not reversible)")
	}
}
