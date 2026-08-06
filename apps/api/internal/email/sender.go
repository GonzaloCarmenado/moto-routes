// Package email envía correos transaccionales (verificación de cuenta, por
// ahora) sin depender de ningún SDK de proveedor.
package email

import "context"

// Sender envía un email HTML a un único destinatario.
type Sender interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}
