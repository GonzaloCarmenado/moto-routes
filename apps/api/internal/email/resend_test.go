package email

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResendSender_SendPostsTheExpectedRequest(t *testing.T) {
	var gotMethod, gotPath, gotAuth string
	var gotBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"fake-id"}`))
	}))
	defer server.Close()

	sender := ResendSender{APIKey: "test-key", From: "Moto Routes <no-reply@example.com>", BaseURL: server.URL}

	err := sender.Send(context.Background(), "rider@example.com", "Confirma tu email", "<p>hola</p>")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != http.MethodPost {
		t.Fatalf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/emails" {
		t.Fatalf("expected path /emails, got %s", gotPath)
	}
	if gotAuth != "Bearer test-key" {
		t.Fatalf("expected Authorization 'Bearer test-key', got %q", gotAuth)
	}
	if gotBody["from"] != "Moto Routes <no-reply@example.com>" {
		t.Fatalf("expected from in body, got %v", gotBody["from"])
	}
	if gotBody["subject"] != "Confirma tu email" {
		t.Fatalf("expected subject in body, got %v", gotBody["subject"])
	}
	if gotBody["html"] != "<p>hola</p>" {
		t.Fatalf("expected html in body, got %v", gotBody["html"])
	}
	to, ok := gotBody["to"].([]any)
	if !ok || len(to) != 1 || to[0] != "rider@example.com" {
		t.Fatalf("expected to=[rider@example.com], got %v", gotBody["to"])
	}
}

func TestResendSender_SendPropagatesErrorOnNonSuccessStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"invalid from address"}`))
	}))
	defer server.Close()

	sender := ResendSender{APIKey: "test-key", From: "Moto Routes <no-reply@example.com>", BaseURL: server.URL}

	err := sender.Send(context.Background(), "rider@example.com", "Confirma tu email", "<p>hola</p>")
	if err == nil {
		t.Fatal("expected an error when Resend responds with a non-success status")
	}
}
