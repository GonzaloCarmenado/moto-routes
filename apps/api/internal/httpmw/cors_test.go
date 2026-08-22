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

// Gap real encontrado verificando DELETE /api/routes/{id}/photos/{photoId}
// contra un WebView Android real (subida_fotos_mobile): a diferencia de
// Cypress (que no aplica CORS con el mismo rigor que un WebView real), un
// fetch DELETE genuino queda bloqueado en el navegador tras un preflight que
// no incluye "DELETE" en Access-Control-Allow-Methods -- nunca llega a la
// red, así que ni logs de servidor ni curl directo lo revelan.
func TestPublicCORS_AllowsMethodsDELETEForPreflight(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/routes/route-1/photos/photo-1", nil)
	req.Header.Set("Origin", "http://tauri.localhost")
	req.Header.Set("Access-Control-Request-Method", "DELETE")
	rec := httptest.NewRecorder()

	PublicCORS(inner).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, "DELETE") {
		t.Fatalf("expected Access-Control-Allow-Methods to include DELETE, got %q", got)
	}
}

// Mismo gap, cuarta vez: PATCH /api/auth/username (nombre-usuario) quedaba
// fuera de Access-Control-Allow-Methods, así que el preflight lo rechazaba
// antes de llegar a la red. A diferencia del gap de DELETE, este sí se
// reprodujo con Cypress real (fetch() rechaza con "TypeError: Failed to
// fetch"), no solo contra un WebView Android -- la asunción de que Cypress
// no aplica CORS con el mismo rigor no era una garantía general.
func TestPublicCORS_AllowsMethodsPATCHForPreflight(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/auth/username", nil)
	req.Header.Set("Origin", "http://localhost:1420")
	req.Header.Set("Access-Control-Request-Method", "PATCH")
	rec := httptest.NewRecorder()

	PublicCORS(inner).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, "PATCH") {
		t.Fatalf("expected Access-Control-Allow-Methods to include PATCH, got %q", got)
	}
}
