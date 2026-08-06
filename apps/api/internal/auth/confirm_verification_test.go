package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func doConfirmVerification(t *testing.T, handler http.Handler, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/verify-email/confirm?token="+token, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestConfirmVerificationHandler_ValidTokenVerifiesTheAccount(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	user, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	tokenStore := newFakeVerificationTokenStore()
	rawToken := "valid-token"
	if err := tokenStore.CreateToken(context.Background(), user.ID, hashVerificationToken(rawToken), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("unexpected error seeding token: %v", err)
	}
	handler := ConfirmVerificationHandler(userStore, tokenStore)

	rec := doConfirmVerification(t, handler, rawToken)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	verified, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading user: %v", err)
	}
	if !verified.EmailVerified {
		t.Fatal("expected the account to be verified after a valid token confirmation")
	}
}

func TestConfirmVerificationHandler_AlreadyUsedTokenIsRejectedWithoutChangingState(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	user, _ := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	tokenStore := newFakeVerificationTokenStore()
	rawToken := "already-used-token"
	if err := tokenStore.CreateToken(context.Background(), user.ID, hashVerificationToken(rawToken), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("unexpected error seeding token: %v", err)
	}
	stored, _ := tokenStore.FindByHash(context.Background(), hashVerificationToken(rawToken))
	if err := tokenStore.MarkUsed(context.Background(), stored.ID); err != nil {
		t.Fatalf("unexpected error pre-marking token used: %v", err)
	}
	handler := ConfirmVerificationHandler(userStore, tokenStore)

	rec := doConfirmVerification(t, handler, rawToken)

	if rec.Code == http.StatusOK {
		t.Fatalf("expected a non-200 status for an already used token, got %d", rec.Code)
	}
	verified, _ := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if verified.EmailVerified {
		t.Fatal("expected the account to remain unverified after rejecting a reused token")
	}
}

func TestConfirmVerificationHandler_ExpiredTokenIsRejectedWithoutVerifying(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	user, _ := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	tokenStore := newFakeVerificationTokenStore()
	rawToken := "expired-token"
	if err := tokenStore.CreateToken(context.Background(), user.ID, hashVerificationToken(rawToken), time.Now().Add(-time.Hour)); err != nil {
		t.Fatalf("unexpected error seeding token: %v", err)
	}
	handler := ConfirmVerificationHandler(userStore, tokenStore)

	rec := doConfirmVerification(t, handler, rawToken)

	if rec.Code == http.StatusOK {
		t.Fatalf("expected a non-200 status for an expired token, got %d", rec.Code)
	}
	verified, _ := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if verified.EmailVerified {
		t.Fatal("expected the account to remain unverified after rejecting an expired token")
	}
}

func TestConfirmVerificationHandler_UnknownTokenGetsTheSameErrorAsExpired(t *testing.T) {
	userStore := newFakeUserStore()
	doRegister(t, userStore, "rider@example.com", "correct-horse-battery")
	user, _ := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	tokenStore := newFakeVerificationTokenStore()
	if err := tokenStore.CreateToken(context.Background(), user.ID, hashVerificationToken("expired-token"), time.Now().Add(-time.Hour)); err != nil {
		t.Fatalf("unexpected error seeding token: %v", err)
	}
	handler := ConfirmVerificationHandler(userStore, tokenStore)

	expiredRec := doConfirmVerification(t, handler, "expired-token")
	unknownRec := doConfirmVerification(t, handler, "never-issued-token")

	if unknownRec.Code != expiredRec.Code {
		t.Fatalf("expected the same status for an unknown token as for an expired one, got %d vs %d", unknownRec.Code, expiredRec.Code)
	}
}
