package auth

import "testing"

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		wantErr  bool
	}{
		{"minimum valid length", "abc", false},
		{"maximum valid length", "abcdefghij0123456789", false},
		{"letters, digits and underscore", "rider_42", false},
		{"too short", "ab", true},
		{"too long", "abcdefghij01234567890", true},
		{"empty", "", true},
		{"uppercase not allowed", "Rider42", true},
		{"space not allowed", "rider 42", true},
		{"hyphen not allowed", "rider-42", true},
		{"accented character not allowed", "ríder", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUsername(tt.username)
			if tt.wantErr && err == nil {
				t.Fatalf("expected an error for username %q, got nil", tt.username)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error for username %q, got %v", tt.username, err)
			}
		})
	}
}
