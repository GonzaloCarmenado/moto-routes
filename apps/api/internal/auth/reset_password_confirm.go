package auth

import (
	"net/http"
	"time"
)

const passwordsDoNotMatchMessage = "las contraseñas no coinciden"

// ResetPasswordConfirmHandler sirve (GET) y procesa (POST) el formulario de
// reset de contraseña. El GET solo muestra el formulario si el token es
// válido, no expirado y no usado; el POST valida de nuevo el token (nunca se
// confía en que el cliente no lo haya manipulado entre el GET y el POST) y,
// si todo es correcto, sustituye la contraseña. La cuenta afectada se
// obtiene siempre de PasswordResetTokenStore a partir del token — cualquier
// otro campo del formulario que pretenda identificar una cuenta se ignora
// (ver design.md).
func ResetPasswordConfirmHandler(userStore UserStore, tokenStore PasswordResetTokenStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleResetPasswordConfirmGet(w, r, tokenStore)
		case http.MethodPost:
			handleResetPasswordConfirmPost(w, r, userStore, tokenStore)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func handleResetPasswordConfirmGet(w http.ResponseWriter, r *http.Request, tokenStore PasswordResetTokenStore) {
	token := r.URL.Query().Get("token")

	if !resetTokenIsValid(r, tokenStore, token) {
		writeHTMLPage(w, http.StatusBadRequest, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}

	writeHTMLPage(w, http.StatusOK, renderResetPasswordPage(resetPasswordPageData{Token: token, ShowForm: true}))
}

func handleResetPasswordConfirmPost(w http.ResponseWriter, r *http.Request, userStore UserStore, tokenStore PasswordResetTokenStore) {
	if err := r.ParseForm(); err != nil {
		writeHTMLPage(w, http.StatusBadRequest, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}

	token := r.PostFormValue("token")
	password := r.PostFormValue("password")
	confirmation := r.PostFormValue("password_confirmation")

	stored, ok := resetTokenLookup(r, tokenStore, token)
	if !ok {
		writeHTMLPage(w, http.StatusBadRequest, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}

	if password != confirmation {
		writeHTMLPage(w, http.StatusBadRequest, renderResetPasswordPage(resetPasswordPageData{
			Token: token, ShowForm: true, ErrorMessage: passwordsDoNotMatchMessage,
		}))
		return
	}

	if err := validatePassword(password); err != nil {
		writeHTMLPage(w, http.StatusBadRequest, renderResetPasswordPage(resetPasswordPageData{
			Token: token, ShowForm: true, ErrorMessage: "la contraseña no cumple la política mínima de complejidad",
		}))
		return
	}

	hash, err := hashPassword(password)
	if err != nil {
		writeHTMLPage(w, http.StatusInternalServerError, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}

	if err := userStore.UpdatePasswordHash(r.Context(), stored.UserID, hash); err != nil {
		writeHTMLPage(w, http.StatusInternalServerError, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}
	if err := userStore.MarkEmailVerified(r.Context(), stored.UserID); err != nil {
		writeHTMLPage(w, http.StatusInternalServerError, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}
	if err := tokenStore.MarkUsed(r.Context(), stored.ID); err != nil {
		writeHTMLPage(w, http.StatusInternalServerError, renderResetPasswordPage(resetPasswordPageData{}))
		return
	}

	writeHTMLPage(w, http.StatusOK, renderResetPasswordPage(resetPasswordPageData{Success: true}))
}

func resetTokenIsValid(r *http.Request, tokenStore PasswordResetTokenStore, token string) bool {
	_, ok := resetTokenLookup(r, tokenStore, token)
	return ok
}

// resetTokenLookup busca el token y confirma que no está usado ni caducado.
func resetTokenLookup(r *http.Request, tokenStore PasswordResetTokenStore, token string) (StoredPasswordResetToken, bool) {
	if token == "" {
		return StoredPasswordResetToken{}, false
	}
	stored, err := tokenStore.FindByHash(r.Context(), hashOneTimeToken(token))
	if err != nil || stored.UsedAt != nil || time.Now().After(stored.ExpiresAt) {
		return StoredPasswordResetToken{}, false
	}
	return stored, true
}

func writeHTMLPage(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
