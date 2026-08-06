package auth

import (
	"strings"
	"testing"
)

func TestResetPasswordEmailContent_IncludesConfirmationLinkWithTokenOnly(t *testing.T) {
	subject, html := resetPasswordEmailContent("https://debian.taildf3dab.ts.net", "abc123")

	if subject == "" {
		t.Fatal("expected a non-empty subject")
	}

	wantLink := "https://debian.taildf3dab.ts.net/api/auth/reset-password/confirm?token=abc123"
	if !strings.Contains(html, wantLink) {
		t.Fatalf("expected html body to contain confirmation link %q, got: %s", wantLink, html)
	}
}
