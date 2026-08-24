package adminstatus

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
	"github.com/crzverde/moto-routes/apps/api/internal/httpmw"
)

// TestAdminEndpoint_ShowsHTTPErrorsAndEmailDeliveryFailuresTogether verifica
// el requisito "fallos de entrega y eventos de error/warning son
// consultables juntos" (spec alertas-fallos-email): un 5xx capturado por
// httpmw y un fallo de entrega de email recibido por el webhook de Resend
// comparten el mismo registro y aparecen juntos en /admin/status,
// distinguibles por su Kind.
func TestAdminEndpoint_ShowsHTTPErrorsAndEmailDeliveryFailuresTogether(t *testing.T) {
	logger := newTestLogger(t)
	const webhookSecret = "test-webhook-secret"
	const adminToken = "test-admin-token"

	// Un 5xx real capturado por el middleware transversal.
	failing := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	httpReq := httptest.NewRequest(http.MethodGet, "/api/routes", nil)
	httpRec := httptest.NewRecorder()
	httpmw.CaptureErrors(logger)(failing).ServeHTTP(httpRec, httpReq)

	// Un fallo de entrega de email real recibido por el webhook.
	body := `{"type":"email.bounced","data":{"to":["dest@example.com"]}}`
	svixID, svixTimestamp := "msg_1", "1700000000"
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write([]byte(svixID + "." + svixTimestamp + "." + body))
	signature := "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))

	webhookReq := httptest.NewRequest(http.MethodPost, "/api/webhooks/resend", strings.NewReader(body))
	webhookReq.Header.Set("svix-id", svixID)
	webhookReq.Header.Set("svix-timestamp", svixTimestamp)
	webhookReq.Header.Set("svix-signature", signature)
	webhookRec := httptest.NewRecorder()
	email.WebhookHandler(logger, webhookSecret)(webhookRec, webhookReq)

	// Ambos deben verse juntos desde el endpoint admin.
	adminReq := httptest.NewRequest(http.MethodGet, "/admin/status", nil)
	adminReq.Header.Set("Authorization", "Bearer "+adminToken)
	adminRec := httptest.NewRecorder()
	Handler(logger, adminToken, stubMetricsReader{}).ServeHTTP(adminRec, adminReq)

	var got response
	if err := json.Unmarshal(adminRec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Events) != 2 {
		t.Fatalf("expected 2 events (1 http_error + 1 email_delivery_failure), got %d: %+v", len(got.Events), got.Events)
	}

	var kinds []string
	for _, ev := range got.Events {
		kinds = append(kinds, ev.Kind)
	}
	hasHTTPError := false
	hasEmailFailure := false
	for _, k := range kinds {
		if k == "http_error" {
			hasHTTPError = true
		}
		if k == "email_delivery_failure" {
			hasEmailFailure = true
		}
	}
	if !hasHTTPError || !hasEmailFailure {
		t.Fatalf("expected both http_error and email_delivery_failure kinds present, got %v", kinds)
	}
}
