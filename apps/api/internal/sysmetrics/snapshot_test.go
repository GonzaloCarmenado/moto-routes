package sysmetrics

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadSnapshot_FileMissing_ReturnsNotAvailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")

	_, ok := ReadSnapshot(path)

	if ok {
		t.Fatal("expected ok=false when the metrics file does not exist yet")
	}
}

func TestReadSnapshot_FilePresent_ReturnsSnapshot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	body := `{
		"timestamp": "2026-08-24T10:00:00Z",
		"memory": {"usedBytes": 800, "totalBytes": 1000},
		"disk": {"usedBytes": 500, "totalBytes": 2000}
	}`
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	snap, ok := ReadSnapshot(path)

	if !ok {
		t.Fatal("expected ok=true when the metrics file is present and valid")
	}
	if snap.Memory.UsedBytes != 800 || snap.Memory.TotalBytes != 1000 {
		t.Fatalf("unexpected memory snapshot: %+v", snap.Memory)
	}
	if snap.Disk.UsedBytes != 500 || snap.Disk.TotalBytes != 2000 {
		t.Fatalf("unexpected disk snapshot: %+v", snap.Disk)
	}
}

func TestReadSnapshot_CorruptFile_ReturnsNotAvailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sysmetrics.json")
	if err := os.WriteFile(path, []byte("not json"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	_, ok := ReadSnapshot(path)

	if ok {
		t.Fatal("expected ok=false for a corrupt metrics file, not a crash")
	}
}

func TestResourceSnapshot_UsedPercent(t *testing.T) {
	s := ResourceSnapshot{UsedBytes: 900, TotalBytes: 1000}
	if got := s.UsedPercent(); got != 90 {
		t.Fatalf("expected 90%%, got %v", got)
	}
}

func TestResourceSnapshot_UsedPercent_ZeroTotalIsZero(t *testing.T) {
	s := ResourceSnapshot{UsedBytes: 100, TotalBytes: 0}
	if got := s.UsedPercent(); got != 0 {
		t.Fatalf("expected 0%% for zero total, got %v", got)
	}
}
