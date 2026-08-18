package notifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeTokenStore struct {
	tokens  map[int64][]string
	deleted []string
}

func (s *fakeTokenStore) Upsert(context.Context, int64, string, string) error { return nil }
func (s *fakeTokenStore) TokensForUser(_ context.Context, userID int64) ([]string, error) {
	return s.tokens[userID], nil
}
func (s *fakeTokenStore) Delete(_ context.Context, token string) error {
	s.deleted = append(s.deleted, token)
	return nil
}

type capturedFCMRequest struct {
	Message struct {
		Token string            `json:"token"`
		Data  map[string]string `json:"data"`
	} `json:"message"`
}

func TestFCMNotifier_SendsAnOpaquePayloadToEachRegisteredToken(t *testing.T) {
	var captured []capturedFCMRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req capturedFCMRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		captured = append(captured, req)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	tokenStore := &fakeTokenStore{tokens: map[int64][]string{7: {"token-a", "token-b"}}}
	notifier := FCMNotifier{ProjectID: "test-project", BaseURL: server.URL, HTTPClient: server.Client(), TokenStore: tokenStore}

	err := notifier.Send(context.Background(), 7, "route_share_invite", map[string]string{"invitation_id": "inv-1"})
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	if len(captured) != 2 {
		t.Fatalf("expected 2 requests (one per token), got %d", len(captured))
	}
	for _, req := range captured {
		if req.Message.Data["invitation_id"] != "inv-1" {
			t.Fatalf("expected invitation_id in payload, got %+v", req.Message.Data)
		}
		if len(req.Message.Data) != 2 { // invitation_id + type
			t.Fatalf("expected an opaque payload with only the given keys + type, got %+v", req.Message.Data)
		}
	}
}

func TestFCMNotifier_NoTokensIsNotAnError(t *testing.T) {
	tokenStore := &fakeTokenStore{tokens: map[int64][]string{}}
	notifier := FCMNotifier{ProjectID: "test-project", BaseURL: "http://unused.invalid", HTTPClient: http.DefaultClient, TokenStore: tokenStore}

	if err := notifier.Send(context.Background(), 7, "route_share_invite", nil); err != nil {
		t.Fatalf("expected no error when the user has no registered tokens, got %v", err)
	}
}

func TestFCMNotifier_InvalidTokenIsDeletedFromTheStore(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tokenStore := &fakeTokenStore{tokens: map[int64][]string{7: {"stale-token"}}}
	notifier := FCMNotifier{ProjectID: "test-project", BaseURL: server.URL, HTTPClient: server.Client(), TokenStore: tokenStore}

	_ = notifier.Send(context.Background(), 7, "route_share_invite", nil)

	if len(tokenStore.deleted) != 1 || tokenStore.deleted[0] != "stale-token" {
		t.Fatalf("expected stale-token to be deleted, got %+v", tokenStore.deleted)
	}
}

func TestFCMNotifier_ServerErrorIsReturnedButDoesNotDeleteTheToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	tokenStore := &fakeTokenStore{tokens: map[int64][]string{7: {"token-a"}}}
	notifier := FCMNotifier{ProjectID: "test-project", BaseURL: server.URL, HTTPClient: server.Client(), TokenStore: tokenStore}

	err := notifier.Send(context.Background(), 7, "route_share_invite", nil)

	if err == nil {
		t.Fatal("expected an error when FCM responds with a server error")
	}
	if len(tokenStore.deleted) != 0 {
		t.Fatalf("expected the token to remain registered, got deleted=%+v", tokenStore.deleted)
	}
}
