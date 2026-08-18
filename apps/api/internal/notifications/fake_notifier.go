package notifications

import (
	"context"
	"errors"
)

// FakeNotifier es un Notifier en memoria para tests de comportamiento de
// handlers que no deben depender de un envío real a Firebase — mismo patrón
// que email.FakeSender.
type FakeNotifier struct {
	// FailWith, si no es nil, hace que Send siempre falle con este error.
	FailWith error
	Sent     []SentNotification
}

// SentNotification registra los parámetros de una llamada a Send.
type SentNotification struct {
	UserID    int64
	EventType string
	Data      map[string]string
}

// Send registra la notificación enviada, o devuelve FailWith si está configurado.
func (n *FakeNotifier) Send(_ context.Context, userID int64, eventType string, data map[string]string) error {
	if n.FailWith != nil {
		return n.FailWith
	}
	n.Sent = append(n.Sent, SentNotification{UserID: userID, EventType: eventType, Data: data})
	return nil
}

// ErrFakeSendFailure es un error de ejemplo listo para usar como FailWith.
var ErrFakeSendFailure = errors.New("fake notifier: simulated failure")
