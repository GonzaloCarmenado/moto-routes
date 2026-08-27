package webui

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandler_ServesIndexAtRoot(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/dashboard/", nil)
	rec := httptest.NewRecorder()

	Handler("/dashboard").ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "<html") {
		t.Fatalf("body no parece HTML: %q", rec.Body.String())
	}
}

func TestHandler_UnknownClientRoute_FallsBackToIndex(t *testing.T) {
	// /dashboard/login no es un fichero real del build — el router de cliente
	// (SPA) lo resuelve en el navegador, así que el servidor debe devolver
	// index.html en vez de un 404 (design.md, Decisión 1).
	req := httptest.NewRequest(http.MethodGet, "/dashboard/login", nil)
	rec := httptest.NewRecorder()

	Handler("/dashboard").ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "<html") {
		t.Fatalf("body no parece el fallback a index.html: %q", rec.Body.String())
	}
}
