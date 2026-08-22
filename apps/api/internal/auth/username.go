package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

type usernameRequest struct {
	Username string `json:"username"`
}

// UsernameHandler fija o cambia el username de la cuenta autenticada — misma
// operación tanto si la cuenta no tenía username todavía (pantalla de
// bloqueo) como si ya tenía otro (edición desde perfil), ver nombre-usuario,
// design.md Decisión 2.
func UsernameHandler(store UserStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
			return
		}

		var req usernameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := validateUsername(req.Username); err != nil {
			writeError(w, http.StatusBadRequest, "invalid username")
			return
		}

		if err := store.UpdateUsername(r.Context(), userID, req.Username); err != nil {
			if errors.Is(err, ErrUsernameTaken) {
				writeError(w, http.StatusConflict, "username already taken")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		w.WriteHeader(http.StatusOK)
	})
}

// RateLimitedUsernameHandler envuelve UsernameHandler limitando intentos
// repetidos por cuenta — keyed por userID (endpoint autenticado, a
// diferencia de RateLimitedRegisterHandler que keyea por email porque ahí
// todavía no hay sesión). Mismo patrón de envoltura.
func RateLimitedUsernameHandler(store UserStore, limiter *LoginRateLimiter) http.Handler {
	inner := UsernameHandler(store)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
			return
		}

		key := strconv.FormatInt(userID, 10)
		if !limiter.Allowed(key) {
			writeError(w, http.StatusTooManyRequests, "too many attempts, try again later")
			return
		}
		limiter.RecordFailure(key)

		inner.ServeHTTP(w, r)
	})
}
