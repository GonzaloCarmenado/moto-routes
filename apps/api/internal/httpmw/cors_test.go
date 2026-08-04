package httpmw

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicCORS_SetsWildcardAllowOrigin(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/stop-types", nil)
	req.Header.Set("Origin", "http://localhost:1420")
	rec := httptest.NewRecorder()

	PublicCORS(ok).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin: *, got %q", got)
	}
}

func TestPublicCORS_PassesThroughTheInnerResponse(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("fine"))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/stop-types", nil)
	rec := httptest.NewRecorder()

	PublicCORS(ok).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "fine" {
		t.Fatalf("expected the inner handler's response to pass through unchanged, got %d %q", rec.Code, rec.Body.String())
	}
}
