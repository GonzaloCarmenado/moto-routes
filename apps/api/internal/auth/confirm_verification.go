package auth

import (
	"net/http"
	"time"
)

const verificationPageTitle = "Moto Routes — Verificación de email"

const verificationFailureBody = `<h1>Enlace no válido</h1><p>El enlace de verificación no es válido o ha caducado. Puedes solicitar uno nuevo.</p>`
const verificationSuccessBody = `<h1>Email verificado</h1><p>Email verificado correctamente. Ya puedes iniciar sesión.</p>`

// ConfirmVerificationHandler confirma un token de verificación de email
// recibido por GET (el email solo puede disparar una acción sin JavaScript
// mediante un enlace clicable — ver design.md). Un token ya usado, expirado
// o inexistente/manipulado se rechaza con el mismo tipo de error, sin
// distinguir el motivo exacto.
func ConfirmVerificationHandler(userStore UserStore, tokenStore VerificationTokenStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			writeHTMLPage(w, http.StatusBadRequest, authPageShell(verificationPageTitle, verificationFailureBody))
			return
		}

		stored, err := tokenStore.FindByHash(r.Context(), hashOneTimeToken(token))
		if err != nil || stored.UsedAt != nil || time.Now().After(stored.ExpiresAt) {
			writeHTMLPage(w, http.StatusBadRequest, authPageShell(verificationPageTitle, verificationFailureBody))
			return
		}

		if err := userStore.MarkEmailVerified(r.Context(), stored.UserID); err != nil {
			writeHTMLPage(w, http.StatusInternalServerError, authPageShell(verificationPageTitle, verificationFailureBody))
			return
		}
		if err := tokenStore.MarkUsed(r.Context(), stored.ID); err != nil {
			writeHTMLPage(w, http.StatusInternalServerError, authPageShell(verificationPageTitle, verificationFailureBody))
			return
		}

		writeHTMLPage(w, http.StatusOK, authPageShell(verificationPageTitle, verificationSuccessBody))
	})
}
