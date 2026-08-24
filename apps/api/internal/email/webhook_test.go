package email

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
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

// signWebhook reproduce el esquema Svix (id.timestamp.body firmado con
// HMAC-SHA256, base64) para construir una firma válida en los tests.
func signWebhook(secret, svixID, svixTimestamp, body string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(svixID + "." + svixTimestamp + "." + body))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return "v1," + sig
}

func newSignedWebhookRequest(t *testing.T, secret, body string) *http.Request {
	t.Helper()
	svixID := "msg_test123"
	svixTimestamp := "1700000000"
	signature := signWebhook(secret, svixID, svixTimestamp, body)

	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/resend", strings.NewReader(body))
	req.Header.Set("svix-id", svixID)
	req.Header.Set("svix-timestamp", svixTimestamp)
	req.Header.Set("svix-signature", signature)
	return req
}

func TestWebhookHandler_ValidSignature_BouncedEvent_RecordsDeliveryFailure(t *testing.T) {
	logger := newTestLogger(t)
	const secret = "test-webhook-secret"
	body := `{"type":"email.bounced","data":{"to":["dest@example.com"]}}`

	req := newSignedWebhookRequest(t, secret, body)
	rec := httptest.NewRecorder()

	WebhookHandler(logger, secret)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	events := logger.Recent(10)
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	ev := events[0]
	if ev.Kind != "email_delivery_failure" {
		t.Fatalf("expected kind=email_delivery_failure, got %q", ev.Kind)
	}
	if ev.Fields["to"] != "dest@example.com" {
		t.Fatalf("expected destination address recorded, got %+v", ev.Fields)
	}
	if ev.Fields["resendEvent"] != "email.bounced" {
		t.Fatalf("expected resendEvent=email.bounced, got %+v", ev.Fields)
	}
}

func TestWebhookHandler_ValidSignature_OtherFailureTypes_RecordDeliveryFailure(t *testing.T) {
	for _, eventType := range []string{"email.delivery_delayed", "email.failed", "email.complained"} {
		t.Run(eventType, func(t *testing.T) {
			logger := newTestLogger(t)
			const secret = "test-webhook-secret"
			body := fmt.Sprintf(`{"type":%q,"data":{"to":["dest@example.com"]}}`, eventType)

			req := newSignedWebhookRequest(t, secret, body)
			rec := httptest.NewRecorder()

			WebhookHandler(logger, secret)(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", rec.Code)
			}
			if len(logger.Recent(10)) != 1 {
				t.Fatalf("expected 1 delivery-failure event for %s", eventType)
			}
		})
	}
}

func TestWebhookHandler_InvalidSignature_RejectsWithoutRecording(t *testing.T) {
	logger := newTestLogger(t)
	const secret = "test-webhook-secret"
	body := `{"type":"email.bounced","data":{"to":["dest@example.com"]}}`

	req := newSignedWebhookRequest(t, "wrong-secret", body)
	rec := httptest.NewRecorder()

	WebhookHandler(logger, secret)(rec, req)

	if rec.Code == http.StatusOK {
		t.Fatalf("expected the request to be rejected, got 200")
	}
	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event recorded for an invalid signature")
	}
}

func TestWebhookHandler_MissingSignatureHeaders_RejectsWithoutRecording(t *testing.T) {
	logger := newTestLogger(t)
	const secret = "test-webhook-secret"
	body := `{"type":"email.bounced","data":{"to":["dest@example.com"]}}`

	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/resend", strings.NewReader(body))
	rec := httptest.NewRecorder()

	WebhookHandler(logger, secret)(rec, req)

	if rec.Code == http.StatusOK {
		t.Fatalf("expected the request to be rejected, got 200")
	}
	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no event recorded when signature headers are missing")
	}
}

func TestWebhookHandler_NonFailureEvent_AcceptedButNotRecorded(t *testing.T) {
	logger := newTestLogger(t)
	const secret = "test-webhook-secret"
	body := `{"type":"email.opened","data":{"to":["dest@example.com"]}}`

	req := newSignedWebhookRequest(t, secret, body)
	rec := httptest.NewRecorder()

	WebhookHandler(logger, secret)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (accepted), got %d", rec.Code)
	}
	if len(logger.Recent(10)) != 0 {
		t.Fatal("expected no delivery-failure event recorded for a non-failure event type")
	}
}
