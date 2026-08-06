package auth

import (
	"fmt"
	"net/url"
)

const resetPasswordEmailSubject = "Restablece tu contraseña de Moto Routes"

// resetPasswordEmailContent construye el asunto y el cuerpo HTML mínimo del
// email de reset, con el enlace de confirmación absoluto. El enlace lleva
// únicamente el token — nunca el email ni ningún otro identificador de
// cuenta (ver design.md).
func resetPasswordEmailContent(publicBaseURL, token string) (subject, html string) {
	link := publicBaseURL + "/api/auth/reset-password/confirm?token=" + url.QueryEscape(token)
	html = fmt.Sprintf(
		`<p>Hemos recibido una solicitud para restablecer tu contraseña de Moto Routes.</p><p><a href="%s">Elegir una contraseña nueva</a></p><p>Si no has solicitado esto, ignora este correo — tu contraseña actual sigue siendo válida.</p>`,
		link,
	)
	return resetPasswordEmailSubject, html
}
