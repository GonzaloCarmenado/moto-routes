package auth

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

type registerResponse struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
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

		if err := validateUsername(req.Username); err != nil {
			writeError(w, http.StatusBadRequest, "invalid username")
			return
		}

		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		user, err := store.CreateUser(r.Context(), req.Email, hash, req.Username)
		if err != nil {
			if errors.Is(err, ErrEmailTaken) {
				writeError(w, http.StatusConflict, "email already registered")
				return
			}
			if errors.Is(err, ErrUsernameTaken) {
				writeError(w, http.StatusConflict, "username already taken")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		issueAndSendVerificationToken(r, tokenStore, sender, publicBaseURL, user)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		username := ""
		if user.Username != nil {
			username = *user.Username
		}
		_ = json.NewEncoder(w).Encode(registerResponse{ID: user.ID, Email: user.Email, Username: username})
	})
}

// RateLimitedRegisterHandler envuelve RegisterHandler limitando registros
// repetidos por email — desde este cambio, cada registro dispara además una
// llamada a un proveedor de email externo con cuota limitada, así que un
// abuso del endpoint ya no solo escribe filas de más, también puede agotar
// esa cuota (ver rules.security en el contexto del proyecto). Reutiliza
// LoginRateLimiter, mismo patrón que RateLimitedRequestVerificationHandler.
func RateLimitedRegisterHandler(store UserStore, tokenStore VerificationTokenStore, sender email.Sender, publicBaseURL string, limiter *LoginRateLimiter) http.Handler {
	inner := RegisterHandler(store, tokenStore, sender, publicBaseURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req registerRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Email != "" && !limiter.Allowed(req.Email) {
			writeError(w, http.StatusTooManyRequests, "too many registration attempts, try again later")
			return
		}
		if req.Email != "" {
			limiter.RecordFailure(req.Email)
		}

		inner.ServeHTTP(w, r)
	})
}
