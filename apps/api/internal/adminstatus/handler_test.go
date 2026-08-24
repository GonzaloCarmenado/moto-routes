package adminstatus

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
	"github.com/crzverde/moto-routes/apps/api/internal/sysmetrics"
)

// stubMetricsReader simula la ausencia de instantánea de host, salvo que se
// fije snapshot explícitamente.
type stubMetricsReader struct {
	snapshot sysmetrics.Snapshot
	ok       bool
}

func (s stubMetricsReader) Read() (sysmetrics.Snapshot, bool) { return s.snapshot, s.ok }

func newTestLogger(t *testing.T) *opslog.Logger {
	t.Helper()
	logger, err := opslog.Open(filepath.Join(t.TempDir(), "events.jsonl"), 1<<20)
	if err != nil {
		t.Fatalf("opslog.Open: %v", err)
	}
	return logger
}

func TestHandler_MissingToken_Returns401WithoutData(t *testing.T) {
	logger := newTestLogger(t)
	_ = logger.Record(opslog.Event{Level: opslog.LevelError, Message: "should not leak"})

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{}).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected no body leaked on unauthorized request, got %q", rec.Body.String())
	}
}

func TestHandler_WrongToken_Returns401WithoutData(t *testing.T) {
	logger := newTestLogger(t)
	_ = logger.Record(opslog.Event{Level: opslog.LevelError, Message: "should not leak"})

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	req.Header.Set("Authorization", "Bearer wrong-token")
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{}).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_ValidToken_NoEvents_ReturnsEmptyList(t *testing.T) {
	logger := newTestLogger(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	req.Header.Set("Authorization", "Bearer correct-token")
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{}).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body response
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Events) != 0 {
		t.Fatalf("expected empty events list, got %d", len(body.Events))
	}
}

func TestHandler_ValidToken_ReturnsRecentEventsNewestFirst(t *testing.T) {
	logger := newTestLogger(t)
	_ = logger.Record(opslog.Event{Timestamp: time.Now().UTC(), Level: opslog.LevelError, Message: "first"})
	_ = logger.Record(opslog.Event{Timestamp: time.Now().UTC(), Level: opslog.LevelWarning, Message: "second"})

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	req.Header.Set("Authorization", "Bearer correct-token")
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{}).ServeHTTP(rec, req)

	var body response
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(body.Events))
	}
	if body.Events[0].Message != "second" {
		t.Fatalf("expected newest event first, got %q", body.Events[0].Message)
	}
}

func TestHandler_NoMetricsSnapshotYet_OmitsMemoryAndDisk(t *testing.T) {
	logger := newTestLogger(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	req.Header.Set("Authorization", "Bearer correct-token")
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{ok: false}).ServeHTTP(rec, req)

	var body response
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Memory != nil || body.Disk != nil {
		t.Fatalf("expected no memory/disk data before the first collection, got %+v", body)
	}
}

func TestHandler_MetricsSnapshotAvailable_IncludesMemoryAndDisk(t *testing.T) {
	logger := newTestLogger(t)
	snap := sysmetrics.Snapshot{
		Timestamp: time.Now().UTC(),
		Memory:    sysmetrics.ResourceSnapshot{UsedBytes: 800, TotalBytes: 1000},
		Disk:      sysmetrics.ResourceSnapshot{UsedBytes: 500, TotalBytes: 2000},
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	req.Header.Set("Authorization", "Bearer correct-token")
	rec := httptest.NewRecorder()

	Handler(logger, "correct-token", stubMetricsReader{snapshot: snap, ok: true}).ServeHTTP(rec, req)

	var body response
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Memory == nil || body.Memory.UsedBytes != 800 || body.Memory.TotalBytes != 1000 {
		t.Fatalf("unexpected memory in response: %+v", body.Memory)
	}
	if body.Disk == nil || body.Disk.UsedBytes != 500 || body.Disk.TotalBytes != 2000 {
		t.Fatalf("unexpected disk in response: %+v", body.Disk)
	}
	if body.MetricsTimestamp == nil {
		t.Fatal("expected a metrics timestamp when a snapshot is available")
	}
}
