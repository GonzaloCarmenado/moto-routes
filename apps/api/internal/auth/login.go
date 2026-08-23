package auth

import (
	"encoding/json"
	"errors"
	"net/http"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

const invalidCredentialsMessage = "invalid email or password"
const emailNotVerifiedMessage = "email not verified, check your inbox for the verification link"

// LoginHandler verifica email y contraseña y, si coinciden, emite un access
// token de sesión junto con un refresh token de vida larga (ver spec delta
// de user-auth, renovacion-token-sesion) — el refresh token permite obtener
// un access token nuevo más adelante sin volver a enviar la contraseña. Un
// email inexistente y una contraseña incorrecta responden con el mismo error
// genérico, para no revelar si el email existe. Una cuenta sin verificar se
// rechaza con un error distinto — quien llega hasta aquí ya demostró conocer
// la contraseña, así que distinguirlo no habilita enumeración.
func LoginHandler(store UserStore, issuer TokenIssuer, refreshIssuer RefreshTokenIssuer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := store.FindUserByEmail(r.Context(), req.Email)
		if err != nil {
			if errors.Is(err, ErrUserNotFound) {
				writeError(w, http.StatusUnauthorized, invalidCredentialsMessage)
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		if !verifyPassword(user.PasswordHash, req.Password) {
			writeError(w, http.StatusUnauthorized, invalidCredentialsMessage)
			return
		}

		if !user.EmailVerified {
			writeError(w, http.StatusForbidden, emailNotVerifiedMessage)
			return
		}

		token, err := issuer.Issue(user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		refreshToken, err := refreshIssuer.IssueFor(r.Context(), user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(loginResponse{
			Token:        token,
			RefreshToken: refreshToken,
			ExpiresIn:    int64(issuer.TTL.Seconds()),
		})
	})
}
