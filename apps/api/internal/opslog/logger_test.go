package opslog

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLogger_RecordAndRecent_RoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	logger, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	ev := Event{Timestamp: time.Now().UTC(), Level: LevelError, Message: "boom"}
	if err := logger.Record(ev); err != nil {
		t.Fatalf("Record: %v", err)
	}

	got := logger.Recent(10)
	if len(got) != 1 {
		t.Fatalf("expected 1 event, got %d", len(got))
	}
	if got[0].Message != "boom" || got[0].Level != LevelError {
		t.Fatalf("unexpected event: %+v", got[0])
	}
}

func TestLogger_RecentOrdersNewestFirst(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	logger, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	for _, msg := range []string{"first", "second", "third"} {
		if err := logger.Record(Event{Message: msg}); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	got := logger.Recent(10)
	if len(got) != 3 {
		t.Fatalf("expected 3 events, got %d", len(got))
	}
	if got[0].Message != "third" || got[1].Message != "second" || got[2].Message != "first" {
		t.Fatalf("expected newest-first order, got %+v", got)
	}
}

func TestLogger_RecentRespectsLimit(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	logger, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	for range 5 {
		if err := logger.Record(Event{Message: "event"}); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	got := logger.Recent(2)
	if len(got) != 2 {
		t.Fatalf("expected 2 events, got %d", len(got))
	}
}

func TestLogger_NoEventsYet_ReturnsEmptyNotError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	logger, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	got := logger.Recent(10)
	if len(got) != 0 {
		t.Fatalf("expected no events, got %d", len(got))
	}
}

func TestLogger_BelowMaxSize_KeepsAllEvents(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	logger, err := Open(path, 1<<20) // generoso, nada se descarta
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	for range 10 {
		if err := logger.Record(Event{Message: "event"}); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	got := logger.Recent(100)
	if len(got) != 10 {
		t.Fatalf("expected all 10 events kept, got %d", len(got))
	}
}

func TestLogger_AboveMaxSize_DropsOldestFirst(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	// Límite pequeño a propósito: cada evento serializado ronda ~40-60 bytes,
	// así que este tamaño solo deja hueco para unos pocos.
	logger, err := Open(path, 300)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	for i := range 20 {
		if err := logger.Record(Event{Message: fmt.Sprintf("event-%d", i), Level: LevelError}); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	got := logger.Recent(100)
	if len(got) == 0 {
		t.Fatal("expected at least one event to survive")
	}
	if len(got) >= 20 {
		t.Fatalf("expected old events to be dropped, still have %d", len(got))
	}
	if got[0].Message != "event-19" {
		t.Fatalf("expected the most recently written event to survive, got %+v", got[0])
	}
}

func TestLogger_BurstOfEvents_FileNeverExceedsMaxSize(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	const maxSize = 500
	logger, err := Open(path, maxSize)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	for range 100 {
		if err := logger.Record(Event{Message: "burst", Level: LevelError}); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if info.Size() > maxSize {
		t.Fatalf("expected file size <= %d, got %d", maxSize, info.Size())
	}
}

func TestLogger_EventsSurviveReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	first, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := first.Record(Event{Message: "before restart", Level: LevelWarning}); err != nil {
		t.Fatalf("Record: %v", err)
	}

	second, err := Open(path, 1<<20)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got := second.Recent(10)
	if len(got) != 1 || got[0].Message != "before restart" {
		t.Fatalf("expected event to survive reopen, got %+v", got)
	}
}
