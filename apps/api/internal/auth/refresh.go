package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type refreshResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

const invalidRefreshTokenMessage = "invalid refresh token"

// RefreshHandler canjea un refresh token vigente por un access token nuevo,
// sin exigir contraseña — ver spec delta de user-auth, renovacion-token-sesion.
// Rotación de un solo uso: el token recibido queda inservible tras el canje,
// sustituido por el nuevo que devuelve la respuesta. Inexistente, expirado y
// revocado responden con el mismo 401 genérico, sin distinguir entre ellos
// (mismo criterio anti-enumeración que login).
func RefreshHandler(store RefreshTokenStore, issuer TokenIssuer, refreshTTL time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req refreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
			writeError(w, http.StatusUnauthorized, invalidRefreshTokenMessage)
			return
		}

		newRawToken, err := generateOneTimeToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		userID, err := store.Rotate(r.Context(), hashOneTimeToken(req.RefreshToken), hashOneTimeToken(newRawToken), time.Now().Add(refreshTTL))
		if err != nil {
			if errors.Is(err, ErrRefreshTokenNotFound) {
				writeError(w, http.StatusUnauthorized, invalidRefreshTokenMessage)
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		accessToken, err := issuer.Issue(userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(refreshResponse{
			Token:        accessToken,
			RefreshToken: newRawToken,
			ExpiresIn:    int64(issuer.TTL.Seconds()),
		})
	})
}
