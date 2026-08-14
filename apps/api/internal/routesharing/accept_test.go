package routesharing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/photos"
	"github.com/crzverde/moto-routes/apps/api/internal/routes"
)

type fakePhotoStore struct {
	byRoute map[string][]photos.Photo
	created []photos.Photo
}

func newFakePhotoStore() *fakePhotoStore {
	return &fakePhotoStore{byRoute: map[string][]photos.Photo{}}
}

func (f *fakePhotoStore) Create(_ context.Context, _ int64, photo photos.Photo) (photos.Photo, error) {
	f.created = append(f.created, photo)
	f.byRoute[photo.RouteID] = append(f.byRoute[photo.RouteID], photo)
	return photo, nil
}

func (f *fakePhotoStore) ListByRoute(_ context.Context, _ int64, routeID string) ([]photos.Photo, error) {
	return f.byRoute[routeID], nil
}

func (f *fakePhotoStore) GetByIDForRoute(_ context.Context, _ int64, _, _ string) (photos.Photo, error) {
	return photos.Photo{}, nil
}

func (f *fakePhotoStore) Delete(_ context.Context, _ int64, _, _ string) error { return nil }

type fakeBlobStore struct {
	blobs map[string][]byte
}

func newFakeBlobStore() *fakeBlobStore {
	return &fakeBlobStore{blobs: map[string][]byte{}}
}

func (f *fakeBlobStore) Put(_ context.Context, objectKey string, data []byte) error {
	f.blobs[objectKey] = data
	return nil
}

func (f *fakeBlobStore) Get(_ context.Context, objectKey string) ([]byte, error) {
	return f.blobs[objectKey], nil
}

func (f *fakeBlobStore) Delete(_ context.Context, objectKey string) error {
	delete(f.blobs, objectKey)
	return nil
}

func TestAcceptHandler_ClonesMetadataPointsStopsAndPhotosAsNewIndependentRoute(t *testing.T) {
	shareStore := newFakeShareStore()
	name := "Ruta original"
	shareStore.acceptedInv = Invitation{ID: "inv-1", RouteID: "route-1", FromUserID: 1, ToUserID: 2, Status: StatusAccepted}

	routeStore := newFakeRouteStore()
	routeStore.byUser[1] = map[string]*routes.Detail{
		"route-1": {
			Route: routes.Route{ID: "route-1", Name: &name, IsFavorite: true, Duration: 60, TotalDistance: 10, AvgSpeed: 20, Status: "completed"},
			Points: []routes.Point{{Timestamp: 1000, Lat: 40.1, Lng: -3.1}},
			Stops:  []routes.Stop{{StartTime: 1000, Lat: 40.1, Lng: -3.1, Type: "manual"}},
		},
	}

	photoStore := newFakePhotoStore()
	photoStore.byRoute["route-1"] = []photos.Photo{{ID: "photo-1", RouteID: "route-1", MimeType: "image/jpeg", ObjectKey: "routes/route-1/photo-1"}}

	blobStore := newFakeBlobStore()
	blobStore.blobs["routes/route-1/photo-1"] = []byte("encrypted-bytes")

	handler := auth.RequireAuth(testIssuer())(AcceptHandler(shareStore, routeStore, photoStore, blobStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/accept", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	toUserRoutes := routeStore.byUser[2]
	if len(toUserRoutes) != 1 {
		t.Fatalf("expected 1 cloned route for the recipient, got %d", len(toUserRoutes))
	}
	var cloned *routes.Detail
	for _, r := range toUserRoutes {
		cloned = r
	}
	if cloned.ID == "route-1" {
		t.Fatal("expected the cloned route to have a new id, not the original")
	}
	if cloned.Name == nil || *cloned.Name != "Ruta original" {
		t.Fatalf("expected the name to be copied, got %+v", cloned.Name)
	}
	if len(cloned.Points) != 1 || len(cloned.Stops) != 1 {
		t.Fatalf("expected points and stops to be copied, got %+v", cloned)
	}
	if cloned.IsFavorite {
		t.Fatal("expected the cloned route to not be marked as favorite (design.md D5)")
	}

	clonedPhotos := photoStore.byRoute[cloned.ID]
	if len(clonedPhotos) != 1 {
		t.Fatalf("expected 1 cloned photo, got %d", len(clonedPhotos))
	}
	if clonedPhotos[0].ID == "photo-1" {
		t.Fatal("expected the cloned photo to have a new id, not the original")
	}
	if got := blobStore.blobs[clonedPhotos[0].ObjectKey]; string(got) != "encrypted-bytes" {
		t.Fatalf("expected the cloned blob to have the same ciphertext, got %q", got)
	}
}

func TestAcceptHandler_InvitationNotFoundReturns404WithoutCloning(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.acceptErr = ErrInvitationNotFound

	routeStore := newFakeRouteStore()
	photoStore := newFakePhotoStore()
	blobStore := newFakeBlobStore()

	handler := auth.RequireAuth(testIssuer())(AcceptHandler(shareStore, routeStore, photoStore, blobStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-1/accept", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "inv-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if len(photoStore.created) != 0 {
		t.Fatal("expected no photo cloning when the invitation lookup fails")
	}
}

func TestAcceptHandler_RouteWithoutPhotosClonesCleanly(t *testing.T) {
	shareStore := newFakeShareStore()
	shareStore.acceptedInv = Invitation{ID: "inv-2", RouteID: "route-2", FromUserID: 1, ToUserID: 2, Status: StatusAccepted}

	routeStore := newFakeRouteStore()
	routeStore.byUser[1] = map[string]*routes.Detail{
		"route-2": {Route: routes.Route{ID: "route-2", Duration: 30, TotalDistance: 5, AvgSpeed: 10, Status: "completed"}},
	}
	photoStore := newFakePhotoStore()
	blobStore := newFakeBlobStore()

	handler := auth.RequireAuth(testIssuer())(AcceptHandler(shareStore, routeStore, photoStore, blobStore))
	req := httptest.NewRequest(http.MethodPost, "/api/route-shares/inv-2/accept", nil)
	req.Header.Set("Authorization", "Bearer "+bearerFor(t, 2))
	req = withURLParam(req, "id", "inv-2")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(routeStore.byUser[2]) != 1 {
		t.Fatalf("expected 1 cloned route, got %d", len(routeStore.byUser[2]))
	}
}
