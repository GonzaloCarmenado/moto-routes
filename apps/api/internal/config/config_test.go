package config

import "testing"

func TestLoad_RequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("AUTH_TOKEN_SECRET", "test-secret")
	t.Setenv("SERVER_ADDRESS", "")

	_, err := Load()

	if err == nil {
		t.Fatal("expected an error when DATABASE_URL is not set")
	}
}

func TestLoad_RequiresAuthTokenSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("AUTH_TOKEN_SECRET", "")
	t.Setenv("SERVER_ADDRESS", "")

	_, err := Load()

	if err == nil {
		t.Fatal("expected an error when AUTH_TOKEN_SECRET is not set")
	}
}

func TestLoad_DefaultsServerAddressTo0000(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("AUTH_TOKEN_SECRET", "test-secret")
	t.Setenv("SERVER_ADDRESS", "")

	cfg, err := Load()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ServerAddress != "0.0.0.0:8080" {
		t.Fatalf("expected default address 0.0.0.0:8080, got %q", cfg.ServerAddress)
	}
}

func TestLoad_UsesConfiguredServerAddress(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("AUTH_TOKEN_SECRET", "test-secret")
	t.Setenv("SERVER_ADDRESS", "100.64.0.1")

	cfg, err := Load()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ServerAddress != "100.64.0.1:8080" {
		t.Fatalf("expected address 100.64.0.1:8080, got %q", cfg.ServerAddress)
	}
}
