package httpmw

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

func newTestLogger(t *testing.T) *opslog.Logger {
	t.Helper()
	logger, err := opslog.Open(filepath.Join(t.TempDir(), "events.jsonl"), 1<<20)
	if err != nil {
		t.Fatalf("opslog.Open: %v", err)
	}
	return logger
}

func TestRecover_UnhandledPanicReturns500WithoutInternalDetails(t *testing.T) {
	logger := newTestLogger(t)
	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom: SELECT * FROM users WHERE email = 'x' -- unexpected nil pointer at /d/Git/Otros/moto-routes/apps/api/internal/auth/login.go:42")
	})

	req := httptest.NewRequest(http.MethodGet, "/whatever", nil)
	rec := httptest.NewRecorder()

	Recover(logger)(panicking).ServeHTTP(rec, req)

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
	logger := newTestLogger(t)
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("fine"))
	})

	req := httptest.NewRequest(http.MethodGet, "/whatever", nil)
	rec := httptest.NewRecorder()

	Recover(logger)(ok).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "fine" {
		t.Fatalf("expected the inner handler's response to pass through unchanged, got %d %q", rec.Code, rec.Body.String())
	}
	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event to be recorded when there is no panic")
	}
}

func TestRecover_PanicRecordsErrorEvent(t *testing.T) {
	logger := newTestLogger(t)
	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})

	req := httptest.NewRequest(http.MethodPost, "/api/routes", nil)
	rec := httptest.NewRecorder()

	Recover(logger)(panicking).ServeHTTP(rec, req)

	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 event recorded, got %d", len(events))
	}
	ev := events[0]
	if ev.Level != opslog.LevelError {
		t.Fatalf("expected level=error, got %q", ev.Level)
	}
	if !strings.Contains(ev.Message, "boom") {
		t.Fatalf("expected message to mention the recovered panic, got %q", ev.Message)
	}
	if ev.Route != "/api/routes" || ev.Method != http.MethodPost {
		t.Fatalf("expected route/method to be captured, got route=%q method=%q", ev.Route, ev.Method)
	}
}
