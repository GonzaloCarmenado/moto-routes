package email

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

// failureResendEventTypes son los tipos de evento de Resend que representan
// un fallo real de entrega — ver spec "alertas-fallos-email". El resto
// (email.sent, email.delivered, email.opened, email.clicked...) se acepta
// pero no se registra como fallo.
var failureResendEventTypes = map[string]bool{
	"email.bounced":          true,
	"email.delivery_delayed": true,
	"email.failed":           true,
	"email.complained":       true,
}

type resendWebhookEvent struct {
	Type string `json:"type"`
	Data struct {
		To []string `json:"to"`
	} `json:"data"`
}

// WebhookHandler recibe los eventos de resultado de entrega de Resend,
// verificando la firma (esquema Svix: cabeceras svix-id/svix-timestamp/
// svix-signature) antes de procesar nada — ver design.md Decisión 4. Los
// eventos de fallo (rebote, retraso/fallo de entrega, queja) se registran en
// logger; el resto se acepta sin registrar. Una firma inválida o ausente se
// rechaza sin registrar ningún evento (deliberado: no dejar rastro de una
// petición sin autenticar, ver design.md Risks).
func WebhookHandler(logger *opslog.Logger, webhookSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		svixID := r.Header.Get("svix-id")
		svixTimestamp := r.Header.Get("svix-timestamp")
		svixSignature := r.Header.Get("svix-signature")
		if svixID == "" || svixTimestamp == "" || svixSignature == "" ||
			!verifyWebhookSignature(webhookSecret, svixID, svixTimestamp, body, svixSignature) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		var event resendWebhookEvent
		if err := json.Unmarshal(body, &event); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if failureResendEventTypes[event.Type] {
			_ = logger.Record(opslog.Event{
				Timestamp: time.Now().UTC(),
				Level:     opslog.LevelWarning,
				Kind:      "email_delivery_failure",
				Message:   fmt.Sprintf("email delivery failure: %s", event.Type),
				Fields: map[string]string{
					"to":          strings.Join(event.Data.To, ","),
					"resendEvent": event.Type,
				},
			})
		}

		w.WriteHeader(http.StatusOK)
	}
}

// verifyWebhookSignature reproduce la verificación estándar de Svix: HMAC-
// SHA256 en base64 sobre "{svixID}.{svixTimestamp}.{body}", comparado contra
// cada firma versionada ("v1,<base64>", espacio-separadas) del header. El
// secreto puede venir con el prefijo "whsec_" (formato habitual de Svix) —
// se decodifica desde ahí; si no es base64 válido, se usa tal cual como
// clave HMAC (permite un secreto de prueba en texto plano).
func verifyWebhookSignature(secret, svixID, svixTimestamp string, body []byte, signatureHeader string) bool {
	key := decodeWebhookSecret(secret)
	signedContent := svixID + "." + svixTimestamp + "." + string(body)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(signedContent))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	for part := range strings.FieldsSeq(signatureHeader) {
		pieces := strings.SplitN(part, ",", 2)
		if len(pieces) != 2 {
			continue
		}
		if hmac.Equal([]byte(pieces[1]), []byte(expected)) {
			return true
		}
	}
	return false
}

func decodeWebhookSecret(secret string) []byte {
	trimmed := strings.TrimPrefix(secret, "whsec_")
	if decoded, err := base64.StdEncoding.DecodeString(trimmed); err == nil {
		return decoded
	}
	return []byte(secret)
}
