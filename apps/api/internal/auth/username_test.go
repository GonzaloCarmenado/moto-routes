package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func doSetUsername(t *testing.T, store UserStore, userID int64, username string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"username": username})
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPatch, "/api/auth/username", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), userIDContextKey, userID)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()
	UsernameHandler(store).ServeHTTP(rec, req)
	return rec
}

func TestUsernameHandler_SetsUsernameOnAnAccountWithoutOne(t *testing.T) {
	store := newFakeUserStore()
	rec := doRegister(t, store, "rider@example.com", "correct-horse-battery")
	var registered registerResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &registered); err != nil {
		t.Fatalf("failed to decode register response: %v", err)
	}
	// Simula una cuenta preexistente a la migración (design.md Decisión 1).
	stored, _ := store.FindUserByID(context.Background(), registered.ID)
	stored.Username = nil
	store.byEmail["rider@example.com"] = stored

	got := doSetUsername(t, store, registered.ID, "newrider")

	if got.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", got.Code, got.Body.String())
	}
	found, err := store.FindUserByID(context.Background(), registered.ID)
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.Username == nil || *found.Username != "newrider" {
		t.Fatalf("expected username newrider, got %+v", found.Username)
	}
}

func TestUsernameHandler_ChangesAnAlreadySetUsername(t *testing.T) {
	store := newFakeUserStore()
	rec := doRegister(t, store, "rider@example.com", "correct-horse-battery")
	var registered registerResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &registered); err != nil {
		t.Fatalf("failed to decode register response: %v", err)
	}

	got := doSetUsername(t, store, registered.ID, "changedname")

	if got.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", got.Code, got.Body.String())
	}
	found, err := store.FindUserByID(context.Background(), registered.ID)
	if err != nil {
		t.Fatalf("unexpected error finding user: %v", err)
	}
	if found.Username == nil || *found.Username != "changedname" {
		t.Fatalf("expected username changedname, got %+v", found.Username)
	}
}

func TestUsernameHandler_RejectsInvalidFormat(t *testing.T) {
	store := newFakeUserStore()
	rec := doRegister(t, store, "rider@example.com", "correct-horse-battery")
	var registered registerResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &registered)

	got := doSetUsername(t, store, registered.ID, "AB")

	if got.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", got.Code, got.Body.String())
	}
}

func TestUsernameHandler_RejectsUsernameAlreadyTaken(t *testing.T) {
	store := newFakeUserStore()
	firstRec := doRegister(t, store, "first@example.com", "correct-horse-battery")
	var first registerResponse
	_ = json.Unmarshal(firstRec.Body.Bytes(), &first)
	secondRec := doRegister(t, store, "second@example.com", "correct-horse-battery")
	var second registerResponse
	_ = json.Unmarshal(secondRec.Body.Bytes(), &second)

	got := doSetUsername(t, store, second.ID, first.Username)

	if got.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", got.Code, got.Body.String())
	}
}

func TestUsernameHandler_WithoutSessionIsDenied(t *testing.T) {
	store := newFakeUserStore()
	body, _ := json.Marshal(map[string]string{"username": "newname"})
	req := httptest.NewRequest(http.MethodPatch, "/api/auth/username", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	UsernameHandler(store).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
