package email

import (
	"context"
	"errors"
)

// FakeSender es un Sender en memoria para tests de comportamiento de
// handlers que no deben depender de una llamada HTTP real a Resend.
type FakeSender struct {
	// FailWith, si no es nil, hace que Send siempre falle con este error.
	FailWith error
	Sent     []SentEmail
}

// SentEmail registra los parámetros de una llamada a Send.
type SentEmail struct {
	To      string
	Subject string
	HTML    string
}

// Send registra el email enviado, o devuelve FailWith si está configurado.
func (s *FakeSender) Send(_ context.Context, to, subject, htmlBody string) error {
	if s.FailWith != nil {
		return s.FailWith
	}
	s.Sent = append(s.Sent, SentEmail{To: to, Subject: subject, HTML: htmlBody})
	return nil
}

// ErrFakeSendFailure es un error de ejemplo listo para usar como FailWith.
var ErrFakeSendFailure = errors.New("fake sender: simulated failure")
