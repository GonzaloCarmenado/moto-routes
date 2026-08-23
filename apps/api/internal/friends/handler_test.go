package friends

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type fakeFriendshipStore struct {
	created         []Friendship
	createErr       error
	received        map[int64][]ReceivedRequest
	sent            map[int64][]SentRequest
	accepted        map[int64][]Friend
	acceptedFr      Friendship
	acceptErr       error
	declineErr      error
	revokeErr       error
	declineCalledBy int64
	revokeCalledBy  int64
}

func newFakeFriendshipStore() *fakeFriendshipStore {
	return &fakeFriendshipStore{
		received: map[int64][]ReceivedRequest{},
		sent:     map[int64][]SentRequest{},
		accepted: map[int64][]Friend{},
	}
}

func (f *fakeFriendshipStore) Create(_ context.Context, requesterID, addresseeID int64) (Friendship, error) {
	if f.createErr != nil {
		return Friendship{}, f.createErr
	}
	fr := Friendship{ID: "fr-1", RequesterID: requesterID, AddresseeID: addresseeID, Status: StatusPending}
	f.created = append(f.created, fr)
	return fr, nil
}

func (f *fakeFriendshipStore) ListReceivedPending(_ context.Context, userID int64) ([]ReceivedRequest, error) {
	return f.received[userID], nil
}

func (f *fakeFriendshipStore) ListSent(_ context.Context, userID int64) ([]SentRequest, error) {
	return f.sent[userID], nil
}

func (f *fakeFriendshipStore) ListAccepted(_ context.Context, userID int64) ([]Friend, error) {
	return f.accepted[userID], nil
}

func (f *fakeFriendshipStore) MarkAccepted(_ context.Context, _ int64, _ string) (Friendship, error) {
	return f.acceptedFr, f.acceptErr
}

func (f *fakeFriendshipStore) MarkDeclined(_ context.Context, userID int64, _ string) error {
	f.declineCalledBy = userID
	return f.declineErr
}

func (f *fakeFriendshipStore) MarkRevoked(_ context.Context, userID int64, _ string) error {
	f.revokeCalledBy = userID
	return f.revokeErr
}

type fakeUserStore struct {
	byUsername map[string]auth.StoredUser
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{byUsername: map[string]auth.StoredUser{}}
}

func (f *fakeUserStore) CreateUser(_ context.Context, email, _, username string) (auth.StoredUser, error) {
	user := auth.StoredUser{ID: int64(len(f.byUsername) + 1), Email: email, Username: &username}
	f.byUsername[username] = user
	return user, nil
}

func (f *fakeUserStore) UpdateUsername(_ context.Context, _ int64, _ string) error { return nil }

func (f *fakeUserStore) FindUserByEmail(_ context.Context, _ string) (auth.StoredUser, error) {
	return auth.StoredUser{}, auth.ErrUserNotFound
}

func (f *fakeUserStore) FindUserByUsername(_ context.Context, username string) (auth.StoredUser, error) {
	user, ok := f.byUsername[username]
	if !ok {
		return auth.StoredUser{}, auth.ErrUserNotFound
	}
	return user, nil
}

func (f *fakeUserStore) FindUserByID(_ context.Context, id int64) (auth.StoredUser, error) {
	for _, u := range f.byUsername {
		if u.ID == id {
			return u, nil
		}
	}
	return auth.StoredUser{}, auth.ErrUserNotFound
}

func (f *fakeUserStore) SearchUsernames(_ context.Context, _ string, _ int) ([]string, error) {
	return nil, nil
}

func (f *fakeUserStore) MarkEmailVerified(_ context.Context, _ int64) error { return nil }

func (f *fakeUserStore) UpdatePasswordHash(_ context.Context, _ int64, _ string) error { return nil }

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("friends-handler-test-secret"), TTL: time.Hour}
}

func bearerFor(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testIssuer().Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	return token
}

func doRequest(handler http.Handler, method, url string, body []byte, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, bytes.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func withURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestCreateRequestHandler_ExistingUsernameCreatesRequest(t *testing.T) {
	store := newFakeFriendshipStore()
	userStore := newFakeUserStore()
	userStore.byUsername["friend1"] = auth.StoredUser{ID: 2, Email: "friend@example.com", Username: strPtr("friend1")}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateRequestHandler(store, userStore, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"username": "friend1"})
	rec := doRequest(handler, http.MethodPost, "/api/friends", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if len(store.created) != 1 {
		t.Fatalf("expected 1 request created, got %d", len(store.created))
	}
	if store.created[0].AddresseeID != 2 {
		t.Fatalf("expected request to user 2, got %d", store.created[0].AddresseeID)
	}
}

func TestCreateRequestHandler_NonexistentUsernameRespondsIdenticallyWithoutCreating(t *testing.T) {
	store := newFakeFriendshipStore()
	userStore := newFakeUserStore()

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateRequestHandler(store, userStore, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"username": "ghost"})
	rec := doRequest(handler, http.MethodPost, "/api/friends", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
	var resp genericMessageResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Message != requestCreatedMessage {
		t.Fatalf("expected the generic message, got %q", resp.Message)
	}
	if len(store.created) != 0 {
		t.Fatalf("expected no request created for a nonexistent username, got %d", len(store.created))
	}
}

func TestCreateRequestHandler_SelfOrAlreadyRelatedRespondsIdenticallyWithoutCreating(t *testing.T) {
	store := newFakeFriendshipStore()
	store.createErr = ErrCannotFriendSelf
	userStore := newFakeUserStore()
	userStore.byUsername["me"] = auth.StoredUser{ID: 1, Email: "me@example.com", Username: strPtr("me")}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateRequestHandler(store, userStore, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"username": "me"})
	rec := doRequest(handler, http.MethodPost, "/api/friends", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
}

func TestCreateRequestHandler_RateLimited(t *testing.T) {
	store := newFakeFriendshipStore()
	userStore := newFakeUserStore()
	userStore.byUsername["friend1"] = auth.StoredUser{ID: 2, Username: strPtr("friend1")}

	limiter := auth.NewLoginRateLimiter(1, time.Minute)
	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateRequestHandler(store, userStore, limiter))
	body, _ := json.Marshal(map[string]string{"username": "friend1"})

	first := doRequest(handler, http.MethodPost, "/api/friends", body, bearerFor(t, 1))
	if first.Code != http.StatusOK {
		t.Fatalf("expected first request to succeed, got %d", first.Code)
	}
	second := doRequest(handler, http.MethodPost, "/api/friends", body, bearerFor(t, 1))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on the second request, got %d", second.Code)
	}
}

func TestCreateRequestHandler_WithoutTokenReturns401(t *testing.T) {
	store := newFakeFriendshipStore()
	userStore := newFakeUserStore()

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateRequestHandler(store, userStore, auth.NewLoginRateLimiter(10, time.Minute)))
	rec := doRequest(handler, http.MethodPost, "/api/friends", []byte(`{}`), "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestListReceivedHandler_ReturnsPendingRequests(t *testing.T) {
	store := newFakeFriendshipStore()
	store.received[2] = []ReceivedRequest{{ID: "fr-1", FromUsername: "sender1"}}

	handler := auth.RequireAuth(testIssuer())(ListReceivedHandler(store))
	rec := doRequest(handler, http.MethodGet, "/api/friends/received", nil, bearerFor(t, 2))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var got []ReceivedRequest
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 || got[0].FromUsername != "sender1" {
		t.Fatalf("unexpected received requests: %+v", got)
	}
}

func TestListSentHandler_ReturnsSentRequestsWithStatus(t *testing.T) {
	store := newFakeFriendshipStore()
	store.sent[1] = []SentRequest{{ID: "fr-1", ToUsername: "friend1", Status: StatusPending}}

	handler := auth.RequireAuth(testIssuer())(ListSentHandler(store))
	rec := doRequest(handler, http.MethodGet, "/api/friends/sent", nil, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var got []SentRequest
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 || got[0].ToUsername != "friend1" {
		t.Fatalf("unexpected sent requests: %+v", got)
	}
}

func TestListFriendsHandler_ReturnsAcceptedFriends(t *testing.T) {
	store := newFakeFriendshipStore()
	store.accepted[1] = []Friend{{Username: "friend1"}}

	handler := auth.RequireAuth(testIssuer())(ListFriendsHandler(store))
	rec := doRequest(handler, http.MethodGet, "/api/friends", nil, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var got []Friend
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 || got[0].Username != "friend1" {
		t.Fatalf("unexpected friends: %+v", got)
	}
}

func TestAcceptHandler_MarksAcceptedAsAuthenticatedUser(t *testing.T) {
	store := newFakeFriendshipStore()

	handler := auth.RequireAuth(testIssuer())(AcceptHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/accept", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestAcceptHandler_NotFoundReturns404(t *testing.T) {
	store := newFakeFriendshipStore()
	store.acceptErr = ErrFriendRequestNotFound

	handler := auth.RequireAuth(testIssuer())(AcceptHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/accept", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestDeclineHandler_MarksDeclinedAsAuthenticatedUser(t *testing.T) {
	store := newFakeFriendshipStore()

	handler := auth.RequireAuth(testIssuer())(DeclineHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/decline", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if store.declineCalledBy != 2 {
		t.Fatalf("expected MarkDeclined to be called with userID 2, got %d", store.declineCalledBy)
	}
}

func TestDeclineHandler_NotFoundReturns404(t *testing.T) {
	store := newFakeFriendshipStore()
	store.declineErr = ErrFriendRequestNotFound

	handler := auth.RequireAuth(testIssuer())(DeclineHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/decline", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestRevokeHandler_MarksRevokedAsAuthenticatedUser(t *testing.T) {
	store := newFakeFriendshipStore()

	handler := auth.RequireAuth(testIssuer())(RevokeHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/revoke", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 1))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if store.revokeCalledBy != 1 {
		t.Fatalf("expected MarkRevoked to be called with userID 1, got %d", store.revokeCalledBy)
	}
}

func TestRevokeHandler_NotFoundReturns404(t *testing.T) {
	store := newFakeFriendshipStore()
	store.revokeErr = ErrFriendRequestNotFound

	handler := auth.RequireAuth(testIssuer())(RevokeHandler(store))
	req := httptest.NewRequest(http.MethodPost, "/api/friends/fr-1/revoke", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 1))
	req = withURLParam(req, "id", "fr-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func strPtr(s string) *string { return &s }
