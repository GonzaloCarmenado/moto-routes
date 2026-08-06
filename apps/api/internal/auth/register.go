package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerResponse struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
}

// RegisterHandler crea una cuenta nueva a partir de email y contraseña,
// rechazando emails duplicados y contraseñas que no cumplen la política
// mínima. La cuenta se crea con el email sin verificar y se dispara el envío
// del primer email de verificación best-effort: un fallo de envío no impide
// que la cuenta se cree (ver design.md).
func RegisterHandler(store UserStore, tokenStore VerificationTokenStore, sender email.Sender, publicBaseURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req registerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := validateEmail(req.Email); err != nil {
			writeError(w, http.StatusBadRequest, "invalid email")
			return
		}

		if err := validatePassword(req.Password); err != nil {
			writeError(w, http.StatusBadRequest, "password does not meet the minimum complexity policy")
			return
		}

		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		user, err := store.CreateUser(r.Context(), req.Email, hash)
		if err != nil {
			if errors.Is(err, ErrEmailTaken) {
				writeError(w, http.StatusConflict, "email already registered")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		issueAndSendVerificationToken(r, tokenStore, sender, publicBaseURL, user)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(registerResponse{ID: user.ID, Email: user.Email})
	})
}
