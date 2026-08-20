package routesharing

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
	"github.com/crzverde/moto-routes/apps/api/internal/notifications"
	"github.com/crzverde/moto-routes/apps/api/internal/routes"
)

type fakeShareStore struct {
	created         []Invitation
	createErr       error
	received        map[int64][]ReceivedInvitation
	sent            map[int64][]SentInvitation
	acceptedInv     Invitation
	acceptErr       error
	declineErr      error
	revokeErr       error
	declineCalledBy int64
	revokeCalledBy  int64
}

func newFakeShareStore() *fakeShareStore {
	return &fakeShareStore{received: map[int64][]ReceivedInvitation{}, sent: map[int64][]SentInvitation{}}
}

func (f *fakeShareStore) Create(_ context.Context, routeID string, fromUserID, toUserID int64) (Invitation, error) {
	if f.createErr != nil {
		return Invitation{}, f.createErr
	}
	inv := Invitation{ID: "inv-1", RouteID: routeID, FromUserID: fromUserID, ToUserID: toUserID, Status: StatusPending}
	f.created = append(f.created, inv)
	return inv, nil
}

func (f *fakeShareStore) ListReceivedPending(_ context.Context, userID int64) ([]ReceivedInvitation, error) {
	return f.received[userID], nil
}

func (f *fakeShareStore) ListSentByUser(_ context.Context, userID int64) ([]SentInvitation, error) {
	return f.sent[userID], nil
}

func (f *fakeShareStore) MarkAccepted(_ context.Context, _ int64, _ string) (Invitation, error) {
	return f.acceptedInv, f.acceptErr
}

func (f *fakeShareStore) MarkDeclined(_ context.Context, userID int64, _ string) error {
	f.declineCalledBy = userID
	return f.declineErr
}

func (f *fakeShareStore) MarkRevoked(_ context.Context, userID int64, _ string) error {
	f.revokeCalledBy = userID
	return f.revokeErr
}

type fakeRouteStore struct {
	byUser map[int64]map[string]*routes.Detail
}

func newFakeRouteStore() *fakeRouteStore {
	return &fakeRouteStore{byUser: map[int64]map[string]*routes.Detail{}}
}

func (f *fakeRouteStore) Upsert(_ context.Context, userID int64, route routes.Detail) ([]routes.Point, error) {
	if f.byUser[userID] == nil {
		f.byUser[userID] = map[string]*routes.Detail{}
	}
	f.byUser[userID][route.ID] = &route
	return route.Points, nil
}

func (f *fakeRouteStore) ListByUser(_ context.Context, _ int64) ([]routes.Route, error) {
	return nil, nil
}

func (f *fakeRouteStore) GetByIDForUser(_ context.Context, userID int64, id string) (*routes.Detail, error) {
	if byID, ok := f.byUser[userID]; ok {
		return byID[id], nil
	}
	return nil, nil
}

type fakeUserStore struct {
	byEmail map[string]auth.StoredUser
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{byEmail: map[string]auth.StoredUser{}}
}

func (f *fakeUserStore) CreateUser(_ context.Context, email, _ string) (auth.StoredUser, error) {
	user := auth.StoredUser{ID: int64(len(f.byEmail) + 1), Email: email}
	f.byEmail[email] = user
	return user, nil
}

func (f *fakeUserStore) FindUserByEmail(_ context.Context, email string) (auth.StoredUser, error) {
	user, ok := f.byEmail[email]
	if !ok {
		return auth.StoredUser{}, auth.ErrUserNotFound
	}
	return user, nil
}

func (f *fakeUserStore) FindUserByID(_ context.Context, id int64) (auth.StoredUser, error) {
	for _, u := range f.byEmail {
		if u.ID == id {
			return u, nil
		}
	}
	return auth.StoredUser{}, auth.ErrUserNotFound
}

func (f *fakeUserStore) MarkEmailVerified(_ context.Context, id int64) error {
	for email, u := range f.byEmail {
		if u.ID == id {
			u.EmailVerified = true
			f.byEmail[email] = u
		}
	}
	return nil
}

func (f *fakeUserStore) UpdatePasswordHash(_ context.Context, _ int64, _ string) error { return nil }

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("routesharing-handler-test-secret"), TTL: time.Hour}
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

func TestCreateInvitationHandler_EligibleRouteAndVerifiedAccountCreatesInvitation(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	userStore.byEmail["friend@example.com"] = auth.StoredUser{ID: 2, Email: "friend@example.com", EmailVerified: true}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "friend@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if len(shareStore.created) != 1 {
		t.Fatalf("expected 1 invitation created, got %d", len(shareStore.created))
	}
	if shareStore.created[0].ToUserID != 2 {
		t.Fatalf("expected invitation to user 2, got %d", shareStore.created[0].ToUserID)
	}
	if len(notifier.Sent) != 1 {
		t.Fatalf("expected 1 notification sent, got %d", len(notifier.Sent))
	}
	sent := notifier.Sent[0]
	if sent.UserID != 2 || sent.EventType != "route_share_invite" {
		t.Fatalf("expected notification to user 2 of type route_share_invite, got %+v", sent)
	}
	if sent.Data["route_name"] != "" || sent.Data["from_email"] != "" {
		t.Fatalf("expected an opaque payload (no route name or email), got %+v", sent.Data)
	}
}

func TestCreateInvitationHandler_DoesNotNotifyWhenNoInvitationIsCreated(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	// Sin destinatario registrado — Create nunca se llega a invocar.

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "nobody@example.com"})
	doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if len(notifier.Sent) != 0 {
		t.Fatalf("expected no notification sent, got %+v", notifier.Sent)
	}
}

func TestCreateInvitationHandler_NotifierFailureDoesNotUndoTheInvitation(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{FailWith: notifications.ErrFakeSendFailure}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	userStore.byEmail["friend@example.com"] = auth.StoredUser{ID: 2, Email: "friend@example.com", EmailVerified: true}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "friend@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 even though the notifier failed, got %d", rec.Code)
	}
	if len(shareStore.created) != 1 {
		t.Fatalf("expected the invitation to remain created despite the notifier failing, got %d", len(shareStore.created))
	}
}

func TestCreateInvitationHandler_NonexistentEmailRespondsIdenticallyWithoutCreating(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "nobody@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
	var respExists genericMessageResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &respExists)
	if respExists.Message != invitationCreatedMessage {
		t.Fatalf("expected the generic message, got %q", respExists.Message)
	}
	if len(shareStore.created) != 0 {
		t.Fatalf("expected no invitation created for a nonexistent email, got %d", len(shareStore.created))
	}
}

func TestCreateInvitationHandler_UnverifiedAccountRespondsIdenticallyWithoutCreating(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	userStore.byEmail["unverified@example.com"] = auth.StoredUser{ID: 2, Email: "unverified@example.com", EmailVerified: false}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "unverified@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
	if len(shareStore.created) != 0 {
		t.Fatalf("expected no invitation created for an unverified account, got %d", len(shareStore.created))
	}
}

func TestCreateInvitationHandler_NotOwnedOrUnsyncedRouteRespondsIdenticallyWithoutCreating(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	userStore.byEmail["friend@example.com"] = auth.StoredUser{ID: 2, Email: "friend@example.com", EmailVerified: true}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "not-synced-route", "email": "friend@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
	if len(shareStore.created) != 0 {
		t.Fatalf("expected no invitation created for a non-eligible route, got %d", len(shareStore.created))
	}
}

func TestCreateInvitationHandler_SharingWithSelfRespondsIdenticallyWithoutCreating(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.createErr = ErrCannotShareWithSelf
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	userStore.byEmail["me@example.com"] = auth.StoredUser{ID: 1, Email: "me@example.com", EmailVerified: true}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "me@example.com"})
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (generic response), got %d", rec.Code)
	}
}

func TestCreateInvitationHandler_RateLimited(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}
	routeStore.byUser[1] = map[string]*routes.Detail{"route-1": {Route: routes.Route{ID: "route-1"}}}
	userStore.byEmail["friend@example.com"] = auth.StoredUser{ID: 2, Email: "friend@example.com", EmailVerified: true}

	limiter := auth.NewLoginRateLimiter(1, time.Minute)
	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, limiter))
	body, _ := json.Marshal(map[string]string{"route_id": "route-1", "email": "friend@example.com"})

	first := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))
	if first.Code != http.StatusOK {
		t.Fatalf("expected first request to succeed, got %d", first.Code)
	}
	second := doRequest(handler, http.MethodPost, "/api/route-shares", body, bearerFor(t, 1))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on the second request, got %d", second.Code)
	}
}

func TestCreateInvitationHandler_WithoutTokenReturns401(t *testing.T) {
	shareStore := newFakeShareStore()
	routeStore := newFakeRouteStore()
	userStore := newFakeUserStore()
	notifier := &notifications.FakeNotifier{}

	handler := auth.RequireAuth(testIssuer())(RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, auth.NewLoginRateLimiter(10, time.Minute)))
	rec := doRequest(handler, http.MethodPost, "/api/route-shares", []byte(`{}`), "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestListReceivedHandler_ReturnsPendingInvitations(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.received[2] = []ReceivedInvitation{{ID: "inv-1", RouteID: "route-1", FromEmail: "sender@example.com"}}

	handler := auth.RequireAuth(testIssuer())(ListReceivedHandler(shareStore))
	rec := doRequest(handler, http.MethodGet, "/api/route-shares/received", nil, bearerFor(t, 2))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var got []ReceivedInvitation
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 || got[0].FromEmail != "sender@example.com" {
		t.Fatalf("unexpected received invitations: %+v", got)
	}
}

func TestListReceivedHandler_EmptyWhenNoneReceived(t *testing.T) {
	shareStore := newFakeShareStore()

	handler := auth.RequireAuth(testIssuer())(ListReceivedHandler(shareStore))
	rec := doRequest(handler, http.MethodGet, "/api/route-shares/received", nil, bearerFor(t, 2))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Body.String() != "[]\n" {
		t.Fatalf("expected an empty JSON array, got %q", rec.Body.String())
	}
}

func TestListSentHandler_ReturnsSentInvitationsWithStatus(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.sent[1] = []SentInvitation{{ID: "inv-1", RouteID: "route-1", ToEmail: "friend@example.com", Status: StatusPending}}

	handler := auth.RequireAuth(testIssuer())(ListSentHandler(shareStore))
	rec := doRequest(handler, http.MethodGet, "/api/route-shares/sent", nil, bearerFor(t, 1))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var got []SentInvitation
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 || got[0].ToEmail != "friend@example.com" {
		t.Fatalf("unexpected sent invitations: %+v", got)
	}
}

func TestDeclineHandler_MarksDeclinedAsAuthenticatedUser(t *testing.T) {
	shareStore := newFakeShareStore()

	handler := auth.RequireAuth(testIssuer())(DeclineHandler(shareStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/decline", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if shareStore.declineCalledBy != 2 {
		t.Fatalf("expected MarkDeclined to be called with userID 2, got %d", shareStore.declineCalledBy)
	}
}

func TestDeclineHandler_NotFoundReturns404(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.declineErr = ErrInvitationNotFound

	handler := auth.RequireAuth(testIssuer())(DeclineHandler(shareStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/decline", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestRevokeHandler_MarksRevokedAsAuthenticatedUser(t *testing.T) {
	shareStore := newFakeShareStore()

	handler := auth.RequireAuth(testIssuer())(RevokeHandler(shareStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/revoke", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 1))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if shareStore.revokeCalledBy != 1 {
		t.Fatalf("expected MarkRevoked to be called with userID 1, got %d", shareStore.revokeCalledBy)
	}
}

func TestRevokeHandler_NotFoundReturns404(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.revokeErr = ErrInvitationNotFound

	handler := auth.RequireAuth(testIssuer())(RevokeHandler(shareStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/revoke", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 1))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}
