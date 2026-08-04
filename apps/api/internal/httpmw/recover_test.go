package httpmw

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecover_UnhandledPanicReturns500WithoutInternalDetails(t *testing.T) {
	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom: SELECT * FROM users WHERE email = 'x' -- unexpected nil pointer at /d/Git/Otros/moto-routes/apps/api/internal/auth/login.go:42")
	})

	req := httptest.NewRequest(http.MethodGet, "/whatever", nil)
	rec := httptest.NewRecorder()

	Recover(panicking).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", rec.Code)
	}

	body := rec.Body.String()
	forbidden := []string{"SELECT", "goroutine", ".go:", "panic", "nil pointer"}
	for _, term := range forbidden {
		if strings.Contains(body, term) {
			t.Fatalf("response body leaks internal details (%q found): %s", term, body)
		}
	}
}

func TestRecover_NoPanicPassesThrough(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("fine"))
	})

	req := httptest.NewRequest(http.MethodGet, "/whatever", nil)
	rec := httptest.NewRecorder()

	Recover(ok).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "fine" {
		t.Fatalf("expected the inner handler's response to pass through unchanged, got %d %q", rec.Code, rec.Body.String())
	}
}
