package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func doGetResetPasswordConfirm(t *testing.T, handler http.Handler, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/reset-password/confirm?token="+token, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func doPostResetPasswordConfirm(t *testing.T, handler http.Handler, token, password, confirmation string) *httptest.ResponseRecorder {
	t.Helper()
	form := url.Values{"token": {token}, "password": {password}, "password_confirmation": {confirmation}}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password/confirm", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func seedResetToken(t *testing.T, userStore UserStore, tokenStore PasswordResetTokenStore, emailAddr, rawToken string, expiresAt time.Time) StoredUser {
	t.Helper()
	doRegister(t, userStore, emailAddr, "original-password")
	user, err := userStore.FindUserByEmail(context.Background(), emailAddr)
	if err != nil {
		t.Fatalf("unexpected error looking up seeded user: %v", err)
	}
	if err := tokenStore.CreateToken(context.Background(), user.ID, hashOneTimeToken(rawToken), expiresAt); err != nil {
		t.Fatalf("unexpected error seeding token: %v", err)
	}
	return user
}

func TestResetPasswordConfirmHandler_GetWithValidTokenShowsTheForm(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "valid-token", time.Now().Add(time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	rec := doGetResetPasswordConfirm(t, handler, "valid-token")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `name="password"`) {
		t.Fatalf("expected the response to contain a password field, got: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `value="valid-token"`) {
		t.Fatalf("expected the response to contain the token in a hidden field, got: %s", rec.Body.String())
	}
}

func TestResetPasswordConfirmHandler_GetWithInvalidTokenDoesNotShowTheForm(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	rec := doGetResetPasswordConfirm(t, handler, "never-issued")

	if rec.Code == http.StatusOK && strings.Contains(rec.Body.String(), `name="password"`) {
		t.Fatal("expected no password form for an invalid token")
	}
	if strings.Contains(rec.Body.String(), `name="password"`) {
		t.Fatal("expected no password form for an invalid token")
	}
}

func TestResetPasswordConfirmHandler_PostWithValidTokenChangesPassword(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "valid-token", time.Now().Add(time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	rec := doPostResetPasswordConfirm(t, handler, "valid-token", "new-password-123", "new-password-123")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	updated, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading user: %v", err)
	}
	if !verifyPassword(updated.PasswordHash, "new-password-123") {
		t.Fatal("expected the stored password hash to match the new password")
	}
	if !updated.EmailVerified {
		t.Fatal("expected completing a reset to mark the account as verified")
	}
}

func TestResetPasswordConfirmHandler_PostWithMismatchedPasswordsIsRejected(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "valid-token", time.Now().Add(time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	rec := doPostResetPasswordConfirm(t, handler, "valid-token", "new-password-123", "different-password")

	if rec.Code == http.StatusOK {
		t.Fatalf("expected a non-200 status for mismatched passwords, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `name="password"`) {
		t.Fatal("expected the form to be shown again after a mismatch")
	}

	unchanged, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading user: %v", err)
	}
	if !verifyPassword(unchanged.PasswordHash, "original-password") {
		t.Fatal("expected the password to remain unchanged after a mismatch")
	}
}

func TestResetPasswordConfirmHandler_PostWithWeakPasswordIsRejected(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "valid-token", time.Now().Add(time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	rec := doPostResetPasswordConfirm(t, handler, "valid-token", "short", "short")

	if rec.Code == http.StatusOK {
		t.Fatalf("expected a non-200 status for a weak password, got %d", rec.Code)
	}

	unchanged, err := userStore.FindUserByEmail(context.Background(), "rider@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading user: %v", err)
	}
	if !verifyPassword(unchanged.PasswordHash, "original-password") {
		t.Fatal("expected the password to remain unchanged after a weak-password rejection")
	}
}

func TestResetPasswordConfirmHandler_PostWithUsedExpiredOrUnknownTokenIsRejectedTheSameWay(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()

	seedResetToken(t, userStore, tokenStore, "used@example.com", "used-token", time.Now().Add(time.Hour))
	usedStored, _ := tokenStore.FindByHash(context.Background(), hashOneTimeToken("used-token"))
	_ = tokenStore.MarkUsed(context.Background(), usedStored.ID)

	seedResetToken(t, userStore, tokenStore, "expired@example.com", "expired-token", time.Now().Add(-time.Hour))

	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	usedRec := doPostResetPasswordConfirm(t, handler, "used-token", "new-password-123", "new-password-123")
	expiredRec := doPostResetPasswordConfirm(t, handler, "expired-token", "new-password-123", "new-password-123")
	unknownRec := doPostResetPasswordConfirm(t, handler, "never-issued", "new-password-123", "new-password-123")

	if usedRec.Code != expiredRec.Code || expiredRec.Code != unknownRec.Code {
		t.Fatalf("expected the same status for used/expired/unknown tokens, got %d, %d, %d", usedRec.Code, expiredRec.Code, unknownRec.Code)
	}
	if usedRec.Code == http.StatusOK {
		t.Fatal("expected a non-200 status for a used token")
	}
}

func TestResetPasswordConfirmHandler_PostWithExtraAccountFieldIsIgnored(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "victim@example.com", "victim-token-unused", time.Now().Add(time.Hour))
	attackerToken := "attacker-token"
	seedResetToken(t, userStore, tokenStore, "attacker@example.com", attackerToken, time.Now().Add(time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	form := url.Values{
		"token":                  {attackerToken},
		"password":               {"new-password-123"},
		"password_confirmation":  {"new-password-123"},
		"email":                  {"victim@example.com"},
		"user_id":                {"1"},
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password/confirm", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	attacker, err := userStore.FindUserByEmail(context.Background(), "attacker@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading attacker account: %v", err)
	}
	if !verifyPassword(attacker.PasswordHash, "new-password-123") {
		t.Fatal("expected the attacker's own account to be the one changed")
	}

	victim, err := userStore.FindUserByEmail(context.Background(), "victim@example.com")
	if err != nil {
		t.Fatalf("unexpected error re-reading victim account: %v", err)
	}
	if !verifyPassword(victim.PasswordHash, "original-password") {
		t.Fatal("expected the victim's account password to remain unchanged despite the extra form field")
	}
}

func TestResetPasswordConfirmHandler_ExpiredTokenIsRejectedOnGetAndPost(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "expired-token", time.Now().Add(-time.Hour))
	handler := ResetPasswordConfirmHandler(userStore, tokenStore)

	getRec := doGetResetPasswordConfirm(t, handler, "expired-token")
	postRec := doPostResetPasswordConfirm(t, handler, "expired-token", "new-password-123", "new-password-123")

	if getRec.Code == http.StatusOK && strings.Contains(getRec.Body.String(), `name="password"`) {
		t.Fatal("expected GET with an expired token to not show the form")
	}
	if postRec.Code == http.StatusOK {
		t.Fatal("expected POST with an expired token to be rejected")
	}
}

func TestResetPasswordConfirmHandler_CompletedResetAllowsLoginWithNewPasswordOnly(t *testing.T) {
	userStore := newFakeUserStore()
	tokenStore := newFakePasswordResetTokenStore()
	seedResetToken(t, userStore, tokenStore, "rider@example.com", "valid-token", time.Now().Add(time.Hour))
	confirmHandler := ResetPasswordConfirmHandler(userStore, tokenStore)

	doPostResetPasswordConfirm(t, confirmHandler, "valid-token", "new-password-123", "new-password-123")

	issuer := TokenIssuer{Secret: []byte("test-secret"), TTL: time.Hour}
	newPasswordLogin := doLogin(t, userStore, issuer, "rider@example.com", "new-password-123")
	oldPasswordLogin := doLogin(t, userStore, issuer, "rider@example.com", "original-password")

	if newPasswordLogin.Code != http.StatusOK {
		t.Fatalf("expected login with the new password to succeed, got %d: %s", newPasswordLogin.Code, newPasswordLogin.Body.String())
	}
	if oldPasswordLogin.Code == http.StatusOK {
		t.Fatal("expected login with the old password to fail after a reset")
	}
}
