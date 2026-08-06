package auth

import (
	"bytes"
	"html/template"
)

type resetPasswordPageData struct {
	Token        string
	ErrorMessage string
	ShowForm     bool
	Success      bool
}

var resetPasswordPageBodyTemplate = template.Must(template.New("reset-password-body").Parse(`
  {{if .Success}}
    <h1>Contraseña actualizada</h1>
    <p>Ya puedes iniciar sesión con tu contraseña nueva.</p>
  {{else if .ShowForm}}
    <h1>Elige una contraseña nueva</h1>
    {{if .ErrorMessage}}<p class="error">{{.ErrorMessage}}</p>{{end}}
    <form method="POST">
      <input type="hidden" name="token" value="{{.Token}}">
      <label for="password">Contraseña nueva</label>
      <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
      <label for="password_confirmation">Confirma la contraseña</label>
      <input type="password" id="password_confirmation" name="password_confirmation" required minlength="8" autocomplete="new-password">
      <button type="submit">Guardar contraseña</button>
    </form>
  {{else}}
    <h1>Enlace no válido</h1>
    <p>Este enlace de restablecimiento no es válido o ha caducado. Puedes solicitar uno nuevo desde la app.</p>
  {{end}}
`))

// renderResetPasswordPage devuelve el HTML completo de la página (formulario,
// éxito o enlace inválido según data). html/template escapa automáticamente
// cualquier valor interpolado (Token, ErrorMessage), evitando XSS reflejado.
func renderResetPasswordPage(data resetPasswordPageData) []byte {
	var buf bytes.Buffer
	_ = resetPasswordPageBodyTemplate.Execute(&buf, data)
	return authPageShell("Moto Routes — Restablecer contraseña", buf.String())
}
