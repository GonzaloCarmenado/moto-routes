package auth

import (
	"fmt"
	"net/url"
)

const verificationEmailSubject = "Confirma tu email en Moto Routes"

// verificationEmailContent construye el asunto y el cuerpo HTML mínimo del
// email de verificación, con el enlace de confirmación absoluto. No usa
// src/shared/styles/tokens.css: es un email, no la app, y muchos clientes de
// correo ignoran <style> externos de todas formas.
func verificationEmailContent(publicBaseURL, token string) (subject, html string) {
	link := publicBaseURL + "/api/auth/verify-email/confirm?token=" + url.QueryEscape(token)
	html = fmt.Sprintf(
		`<p>Confirma tu cuenta de Moto Routes pulsando el siguiente enlace:</p><p><a href="%s">Verificar mi email</a></p><p>Si no has solicitado esto, ignora este correo.</p>`,
		link,
	)
	return verificationEmailSubject, html
}
