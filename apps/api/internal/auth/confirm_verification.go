package auth

import (
	"net/http"
	"time"
)

const verificationFailureHTML = `<p>El enlace de verificación no es válido o ha caducado. Puedes solicitar uno nuevo.</p>`
const verificationSuccessHTML = `<p>Email verificado correctamente. Ya puedes iniciar sesión.</p>`

// ConfirmVerificationHandler confirma un token de verificación de email
// recibido por GET (el email solo puede disparar una acción sin JavaScript
// mediante un enlace clicable — ver design.md). Un token ya usado, expirado
// o inexistente/manipulado se rechaza con el mismo tipo de error, sin
// distinguir el motivo exacto.
func ConfirmVerificationHandler(userStore UserStore, tokenStore VerificationTokenStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			writeVerificationHTML(w, http.StatusBadRequest, verificationFailureHTML)
			return
		}

		stored, err := tokenStore.FindByHash(r.Context(), hashVerificationToken(token))
		if err != nil || stored.UsedAt != nil || time.Now().After(stored.ExpiresAt) {
			writeVerificationHTML(w, http.StatusBadRequest, verificationFailureHTML)
			return
		}

		if err := userStore.MarkEmailVerified(r.Context(), stored.UserID); err != nil {
			writeVerificationHTML(w, http.StatusInternalServerError, verificationFailureHTML)
			return
		}
		if err := tokenStore.MarkUsed(r.Context(), stored.ID); err != nil {
			writeVerificationHTML(w, http.StatusInternalServerError, verificationFailureHTML)
			return
		}

		writeVerificationHTML(w, http.StatusOK, verificationSuccessHTML)
	})
}

func writeVerificationHTML(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}
