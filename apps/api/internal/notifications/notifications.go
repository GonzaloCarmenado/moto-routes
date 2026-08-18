// Package notifications gestiona el registro de tokens de dispositivo y el
// envío de notificaciones push (Firebase Cloud Messaging) — capa genérica
// por tipo de evento (ver design.md de notificaciones-push-fcm, Decisión 2),
// el primer y único tipo implementado es "route_share_invite".
package notifications

import "context"

// DeviceTokenStore persiste los tokens de dispositivo usados para enviar push.
type DeviceTokenStore interface {
	// Upsert registra un token de dispositivo contra userID. Un mismo token
	// solo puede pertenecer a un usuario a la vez — si ya estaba registrado
	// por otra cuenta (el dispositivo cambió de sesión), se reasigna en vez
	// de duplicar la fila.
	Upsert(ctx context.Context, userID int64, token, platform string) error
	// TokensForUser devuelve los tokens de dispositivo activos de un usuario.
	TokensForUser(ctx context.Context, userID int64) ([]string, error)
	// Delete elimina un token — usado cuando el envío confirma que ya no es válido.
	Delete(ctx context.Context, token string) error
}

// Notifier envía una notificación push a un usuario. El payload transportado
// (data) SHALL ser opaco — solo IDs y el tipo de evento, nunca datos legibles
// como nombres o emails (ver specs/notificaciones-push/spec.md).
type Notifier interface {
	Send(ctx context.Context, userID int64, eventType string, data map[string]string) error
}

// NoopNotifier no envía nada — usado cuando FCM_SERVICE_ACCOUNT_JSON no está
// configurada (ver design.md, Decisión 4: push es opcional, el badge in-app
// sigue siendo la fuente de verdad).
type NoopNotifier struct{}

// Send no hace nada y nunca falla.
func (NoopNotifier) Send(context.Context, int64, string, map[string]string) error { return nil }
