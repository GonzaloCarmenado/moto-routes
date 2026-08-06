package auth

import (
	"strings"
	"testing"
)

func TestVerificationEmailContent_IncludesConfirmationLinkWithToken(t *testing.T) {
	subject, html := verificationEmailContent("https://debian.taildf3dab.ts.net", "abc123")

	if subject == "" {
		t.Fatal("expected a non-empty subject")
	}

	wantLink := "https://debian.taildf3dab.ts.net/api/auth/verify-email/confirm?token=abc123"
	if !strings.Contains(html, wantLink) {
		t.Fatalf("expected html body to contain confirmation link %q, got: %s", wantLink, html)
	}
}
