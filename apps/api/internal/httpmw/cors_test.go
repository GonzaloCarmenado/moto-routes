package httpmw

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestPublicCORS_AnswersPreflightOPTIONSWithoutCallingTheInnerHandler(t *testing.T) {
	innerCalled := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerCalled = true
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:1420")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "content-type")
	rec := httptest.NewRecorder()

	PublicCORS(inner).ServeHTTP(rec, req)

	if innerCalled {
		t.Fatal("expected the preflight OPTIONS request to be answered without reaching the inner handler")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 for a preflight OPTIONS request, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin: *, got %q", got)
	}
}

func TestPublicCORS_SetsAllowedMethodsAndHeadersForPOSTAndAuthorization(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	rec := httptest.NewRecorder()

	PublicCORS(ok).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Fatal("expected Access-Control-Allow-Methods to be set")
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); got == "" || !strings.Contains(got, "Authorization") {
		t.Fatalf("expected Access-Control-Allow-Headers to include Authorization, got %q", got)
	}
}
