package httpmw

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestGlobalMiddleware_CoversEndpointsWithNoOwnErrorHandling verifica el
// requisito "cobertura uniforme de todos los endpoints" (ver
// openspec/changes/observabilidad-produccion): un router que solo aplica
// Recover/CaptureErrors a nivel global (router.Use, como en cmd/api/main.go)
// captura el fallo de un endpoint nuevo que no implementa ninguna captura
// de errores propia — sin tener que envolver esa ruta individualmente.
func TestGlobalMiddleware_CoversEndpointsWithNoOwnErrorHandling(t *testing.T) {
	logger := newTestLogger(t)

	router := chi.NewRouter()
	router.Use(Recover(logger))
	router.Use(CaptureErrors(logger))

	// Endpoint de prueba montado sin ningún middleware ni recover propios —
	// exactamente el caso que la cobertura global debe cubrir por sí sola.
	router.Get("/api/new-thing-that-panics", func(w http.ResponseWriter, r *http.Request) {
		panic("unexpected failure in a brand new endpoint")
	})
	router.Get("/api/new-thing-that-errors", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	t.Run("panic in a bare endpoint is captured", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/new-thing-that-panics", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("expected 500, got %d", rec.Code)
		}
	})

	t.Run("5xx in a bare endpoint is captured", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/new-thing-that-errors", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("expected 500, got %d", rec.Code)
		}
	})

	events := logger.Recent(10)
	if len(events) != 2 {
		t.Fatalf("expected 2 events recorded (one panic, one 5xx) from endpoints with no error handling of their own, got %d: %+v", len(events), events)
	}
}
