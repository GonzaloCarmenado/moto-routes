package auth

import "testing"

func TestGenerateVerificationToken_ProducesNonEmptyUniqueValues(t *testing.T) {
	const attempts = 1000
	seen := make(map[string]bool, attempts)

	for i := 0; i < attempts; i++ {
		token, err := generateOneTimeToken()
		if err != nil {
			t.Fatalf("unexpected error generating token: %v", err)
		}
		if len(token) < 32 {
			t.Fatalf("expected a token with meaningful length, got %d chars: %q", len(token), token)
		}
		if seen[token] {
			t.Fatalf("expected no collisions across %d generations, got a repeat: %q", attempts, token)
		}
		seen[token] = true
	}
}

func TestHashVerificationToken_IsDeterministicAndOneWay(t *testing.T) {
	token, err := generateOneTimeToken()
	if err != nil {
		t.Fatalf("unexpected error generating token: %v", err)
	}

	first := hashOneTimeToken(token)
	second := hashOneTimeToken(token)

	if first != second {
		t.Fatalf("expected hashing the same token twice to produce the same hash, got %q vs %q", first, second)
	}
	if first == token {
		t.Fatal("expected the hash to differ from the raw token")
	}

	otherToken, err := generateOneTimeToken()
	if err != nil {
		t.Fatalf("unexpected error generating second token: %v", err)
	}
	if hashOneTimeToken(otherToken) == first {
		t.Fatal("expected different tokens to hash differently")
	}
}
