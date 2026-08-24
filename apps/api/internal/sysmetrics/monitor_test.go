package sysmetrics

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

func writeSnapshotFixture(t *testing.T, path string, memoryPercent, diskPercent float64) {
	t.Helper()
	snap := Snapshot{
		Memory: ResourceSnapshot{UsedBytes: int64(memoryPercent), TotalBytes: 100},
		Disk:   ResourceSnapshot{UsedBytes: int64(diskPercent), TotalBytes: 100},
	}
	data, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
}

func newTestLogger(t *testing.T) *opslog.Logger {
	t.Helper()
	logger, err := opslog.Open(filepath.Join(t.TempDir(), "events.jsonl"), 1<<20)
	if err != nil {
		t.Fatalf("opslog.Open: %v", err)
	}
	return logger
}

func TestMonitor_BelowThreshold_NoWarning(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	writeSnapshotFixture(t, path, 50, 50)
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	if _, ok := monitor.Read(); !ok {
		t.Fatal("expected a snapshot to be read")
	}
	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no warning below the threshold")
	}
}

func TestMonitor_MemoryAboveThreshold_RecordsWarning(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	writeSnapshotFixture(t, path, 95, 50) // memoria por encima del umbral, disco sano
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	monitor.Read()

	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 warning event, got %d", len(events))
	}
	if events[0].Fields["resource"] != "memory" {
		t.Fatalf("expected resource=memory, got %+v", events[0].Fields)
	}
	if events[0].Level != opslog.LevelWarning {
		t.Fatalf("expected level=warning, got %q", events[0].Level)
	}
}

func TestMonitor_DiskAboveThreshold_RecordsWarning(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	writeSnapshotFixture(t, path, 50, 95) // disco por encima del umbral, memoria sana
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	monitor.Read()

	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 warning event, got %d", len(events))
	}
	if events[0].Fields["resource"] != "disk" {
		t.Fatalf("expected resource=disk, got %+v", events[0].Fields)
	}
	if events[0].Level != opslog.LevelWarning {
		t.Fatalf("expected level=warning, got %q", events[0].Level)
	}
}

func TestMonitor_SustainedAboveThreshold_DoesNotRepeatWarning(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	writeSnapshotFixture(t, path, 95, 50)
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	monitor.Read()
	monitor.Read()
	monitor.Read()

	if len(logger.Recent(10)) != 1 {
		t.Fatalf("expected exactly 1 warning across repeated healthy-still-high reads, got %d", len(logger.Recent(10)))
	}
}

func TestMonitor_CrossesAgainAfterRecovering_RecordsWarningAgain(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	writeSnapshotFixture(t, path, 95, 50)
	monitor.Read() // 1er warning

	writeSnapshotFixture(t, path, 50, 50)
	monitor.Read() // vuelve a estar sano, no debe loguear nada nuevo

	writeSnapshotFixture(t, path, 95, 50)
	monitor.Read() // cruza otra vez: 2o warning

	events := logger.Recent(10)
	if len(events) != 2 {
		t.Fatalf("expected 2 warnings (one per crossing), got %d", len(events))
	}
}

func TestMonitor_BothResourcesAboveThreshold_RecordsTwoWarnings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	writeSnapshotFixture(t, path, 95, 95)
	logger := newTestLogger(t)
	monitor := NewMonitor(path, 90, logger)

	monitor.Read()

	events := logger.Recent(10)
	if len(events) != 2 {
		t.Fatalf("expected 2 warnings (memory and disk), got %d", len(events))
	}
}
