package main

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/notifications"
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

func TestBuildNotifier_WithoutServiceAccountJSON_RecordsWarning(t *testing.T) {
	logger := newTestLogger(t)

	notifier := buildNotifier(context.Background(), "", stubDeviceTokenStore{}, logger)

	if _, ok := notifier.(notifications.NoopNotifier); !ok {
		t.Fatalf("expected a NoopNotifier when FCM_SERVICE_ACCOUNT_JSON is unset, got %T", notifier)
	}

	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 warning event, got %d", len(events))
	}
	if events[0].Level != opslog.LevelWarning {
		t.Fatalf("expected level=warning, got %q", events[0].Level)
	}
}

type stubDeviceTokenStore struct{}

func (stubDeviceTokenStore) Upsert(_ context.Context, _ int64, _, _ string) error { return nil }

func (stubDeviceTokenStore) TokensForUser(_ context.Context, _ int64) ([]string, error) {
	return nil, nil
}

func (stubDeviceTokenStore) Delete(_ context.Context, _ string) error { return nil }
