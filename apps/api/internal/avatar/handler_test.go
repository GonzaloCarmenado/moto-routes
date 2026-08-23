package avatar

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	minio "github.com/minio/minio-go/v7"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/photos"
)

// testBlobStore conecta contra un MinIO real (variables MINIO_* de entorno),
// mismo criterio que internal/photos/blob_store_test.go — tests de
// integración deliberados, no un fake. Reutiliza el mismo bucket de test que
// las fotos de ruta (ver design.md, Decisión 1: sin bucket nuevo).
func testBlobStore(t *testing.T) photos.MinioBlobStore {
	t.Helper()

	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		t.Skip("MINIO_ENDPOINT no está definida; test de integración omitido")
	}
	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	bucket := "test-route-photos"

	store, err := photos.NewMinioBlobStore(endpoint, accessKey, secretKey, bucket, false)
	if err != nil {
		t.Fatalf("failed to create MinIO client: %v", err)
	}

	exists, err := store.Client.BucketExists(t.Context(), bucket)
	if err != nil {
		t.Fatalf("failed to check test bucket: %v", err)
	}
	if !exists {
		if err := store.Client.MakeBucket(t.Context(), bucket, minio.MakeBucketOptions{}); err != nil {
			t.Fatalf("failed to create test bucket: %v", err)
		}
	}

	return store
}

var testEncryptionKey = bytes.Repeat([]byte("k"), photos.KeySize)

func testIssuer() auth.TokenIssuer {
	return auth.TokenIssuer{Secret: []byte("avatar-handler-test-secret"), TTL: time.Hour}
}

func bearerFor(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testIssuer().Issue(userID)
	if err != nil {
		t.Fatalf("failed to issue test token: %v", err)
	}
	return token
}

func multipartAvatarBody(t *testing.T, imageBytes []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("avatar", "avatar.png")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := part.Write(imageBytes); err != nil {
		t.Fatalf("failed to write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}
	return body, writer.FormDataContentType()
}

func uploadRequest(t *testing.T, userID int64, imageBytes []byte) *http.Request {
	t.Helper()
	body, contentType := multipartAvatarBody(t, imageBytes)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/avatar", body)
	req.Header.Set("Content-Type", contentType)
	if userID != 0 {
		req.Header.Set("Authorization", "Bearer "+bearerFor(t, userID))
	}
	return req
}

func downloadRequest(t *testing.T, userID int64) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/avatar", nil)
	if userID != 0 {
		req.Header.Set("Authorization", "Bearer "+bearerFor(t, userID))
	}
	return req
}

func TestUploadAvatarHandler_SuccessMakesItAvailableToDownloadWithSameBytes(t *testing.T) {
	store := testBlobStore(t)
	uploadHandler := auth.RequireAuth(testIssuer())(UploadAvatarHandler(store, testEncryptionKey))
	downloadHandler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))
	imageBytes := []byte("fake png bytes for round-trip test")

	rec := httptest.NewRecorder()
	uploadHandler.ServeHTTP(rec, uploadRequest(t, 501, imageBytes))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	downloadRec := httptest.NewRecorder()
	downloadHandler.ServeHTTP(downloadRec, downloadRequest(t, 501))
	if downloadRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", downloadRec.Code, downloadRec.Body.String())
	}
	got, err := io.ReadAll(downloadRec.Body)
	if err != nil {
		t.Fatalf("unexpected error reading response body: %v", err)
	}
	if !bytes.Equal(got, imageBytes) {
		t.Fatalf("expected the same bytes back, got %q", got)
	}
}

func TestUploadAvatarHandler_StoredBytesAreNotThePlaintextImage(t *testing.T) {
	store := testBlobStore(t)
	uploadHandler := auth.RequireAuth(testIssuer())(UploadAvatarHandler(store, testEncryptionKey))
	imageBytes := []byte("fake png bytes for round-trip test")

	rec := httptest.NewRecorder()
	uploadHandler.ServeHTTP(rec, uploadRequest(t, 506, imageBytes))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	stored, err := store.Get(t.Context(), objectKeyForUser(506))
	if err != nil {
		t.Fatalf("unexpected error reading raw object from blob store: %v", err)
	}
	if bytes.Equal(stored, imageBytes) {
		t.Fatal("expected the stored bytes to be encrypted, not the original plaintext")
	}
}

func TestUploadAvatarHandler_UploadingANewAvatarReplacesThePrevious(t *testing.T) {
	store := testBlobStore(t)
	uploadHandler := auth.RequireAuth(testIssuer())(UploadAvatarHandler(store, testEncryptionKey))
	downloadHandler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))

	uploadHandler.ServeHTTP(httptest.NewRecorder(), uploadRequest(t, 502, []byte("first avatar")))

	secondRec := httptest.NewRecorder()
	uploadHandler.ServeHTTP(secondRec, uploadRequest(t, 502, []byte("second avatar")))
	if secondRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", secondRec.Code, secondRec.Body.String())
	}

	downloadRec := httptest.NewRecorder()
	downloadHandler.ServeHTTP(downloadRec, downloadRequest(t, 502))
	got, err := io.ReadAll(downloadRec.Body)
	if err != nil {
		t.Fatalf("unexpected error reading response body: %v", err)
	}
	if !bytes.Equal(got, []byte("second avatar")) {
		t.Fatalf("expected the replaced avatar bytes, got %q", got)
	}
}

func TestUploadAvatarHandler_OversizedAvatarIsRejectedWithoutReplacingExisting(t *testing.T) {
	store := testBlobStore(t)
	uploadHandler := auth.RequireAuth(testIssuer())(UploadAvatarHandler(store, testEncryptionKey))
	downloadHandler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))

	uploadHandler.ServeHTTP(httptest.NewRecorder(), uploadRequest(t, 503, []byte("existing avatar")))

	oversized := bytes.Repeat([]byte{0xFF}, MaxAvatarSizeBytes+1)
	oversizedRec := httptest.NewRecorder()
	uploadHandler.ServeHTTP(oversizedRec, uploadRequest(t, 503, oversized))
	if oversizedRec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", oversizedRec.Code, oversizedRec.Body.String())
	}

	downloadRec := httptest.NewRecorder()
	downloadHandler.ServeHTTP(downloadRec, downloadRequest(t, 503))
	got, err := io.ReadAll(downloadRec.Body)
	if err != nil {
		t.Fatalf("unexpected error reading response body: %v", err)
	}
	if !bytes.Equal(got, []byte("existing avatar")) {
		t.Fatalf("expected the previous avatar to still be there, got %q", got)
	}
}

func TestUploadAvatarHandler_WithoutSessionIsRejected(t *testing.T) {
	store := testBlobStore(t)
	uploadHandler := auth.RequireAuth(testIssuer())(UploadAvatarHandler(store, testEncryptionKey))
	downloadHandler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))

	rec := httptest.NewRecorder()
	uploadHandler.ServeHTTP(rec, uploadRequest(t, 0, []byte("no session")))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rec.Code, rec.Body.String())
	}

	downloadRec := httptest.NewRecorder()
	downloadHandler.ServeHTTP(downloadRec, downloadRequest(t, 504))
	if downloadRec.Code != http.StatusNotFound {
		t.Fatalf("expected nothing to have been stored (404 on download), got %d", downloadRec.Code)
	}
}

func TestDownloadAvatarHandler_NoAvatarConfiguredReturnsNotFound(t *testing.T) {
	store := testBlobStore(t)
	handler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, downloadRequest(t, 505))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDownloadAvatarHandler_WithoutSessionIsRejected(t *testing.T) {
	store := testBlobStore(t)
	handler := auth.RequireAuth(testIssuer())(DownloadAvatarHandler(store, testEncryptionKey))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, downloadRequest(t, 0))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rec.Code, rec.Body.String())
	}
}
