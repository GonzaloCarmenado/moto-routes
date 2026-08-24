package httpmw

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

func TestCaptureErrors_ServerErrorRecordsEvent(t *testing.T) {
	logger := newTestLogger(t)
	failing := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/routes/123", nil)
	rec := httptest.NewRecorder()

	CaptureErrors(logger)(failing).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected the original status to pass through, got %d", rec.Code)
	}

	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 event recorded, got %d", len(events))
	}
	ev := events[0]
	if ev.Level != opslog.LevelError {
		t.Fatalf("expected level=error, got %q", ev.Level)
	}
	if ev.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected statusCode=502, got %d", ev.StatusCode)
	}
	if ev.Route != "/api/routes/123" || ev.Method != http.MethodGet {
		t.Fatalf("expected route/method to be captured, got route=%q method=%q", ev.Route, ev.Method)
	}
}

func TestCaptureErrors_SuccessDoesNotRecordEvent(t *testing.T) {
	logger := newTestLogger(t)
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	rec := httptest.NewRecorder()

	CaptureErrors(logger)(ok).ServeHTTP(rec, req)

	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event to be recorded for a successful response")
	}
}

func TestCaptureErrors_ClientErrorDoesNotRecordEvent(t *testing.T) {
	logger := newTestLogger(t)
	notFound := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/routes/missing", nil)
	rec := httptest.NewRecorder()

	CaptureErrors(logger)(notFound).ServeHTTP(rec, req)

	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event to be recorded for a 4xx response, only 5xx")
	}
}

func TestCaptureErrors_ImplicitStatusOKIsNotRecorded(t *testing.T) {
	logger := newTestLogger(t)
	// Un handler que escribe body sin llamar WriteHeader implícitamente
	// responde 200 (comportamiento estándar de net/http).
	implicitOK := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/ping", nil)
	rec := httptest.NewRecorder()

	CaptureErrors(logger)(implicitOK).ServeHTTP(rec, req)

	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event to be recorded for an implicit 200")
	}
}
