package auth

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/email"
)

type requestPasswordResetRequest struct {
	Email string `json:"email"`
}

type requestPasswordResetResponse struct {
	Message string `json:"message"`
}

const passwordResetRequestedMessage = "if an account exists for this email, a password reset email has been sent"

// RequestPasswordResetHandler solicita un email de reset de contraseña.
// Responde con el mismo resultado exista o no una cuenta con ese email, para
// no habilitar enumeración de cuentas (ver spec de password-reset).
func RequestPasswordResetHandler(userStore UserStore, tokenStore PasswordResetTokenStore, sender email.Sender, publicBaseURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req requestPasswordResetRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if user, err := userStore.FindUserByEmail(r.Context(), req.Email); err == nil {
			issueAndSendResetToken(r, tokenStore, sender, publicBaseURL, user)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(requestPasswordResetResponse{Message: passwordResetRequestedMessage})
	})
}

// issueAndSendResetToken genera un token nuevo (invalidando cualquier token
// sin usar anterior), lo persiste hasheado y envía el email best-effort — un
// fallo no debe filtrarse en la respuesta genérica, pero sí queda registrado
// en el log del servidor (nunca el token en claro).
func issueAndSendResetToken(r *http.Request, tokenStore PasswordResetTokenStore, sender email.Sender, publicBaseURL string, user StoredUser) {
	token, err := generateOneTimeToken()
	if err != nil {
		log.Printf("password reset: failed to generate token for user %d: %v", user.ID, err)
		return
	}

	if err := tokenStore.CreateToken(r.Context(), user.ID, hashOneTimeToken(token), time.Now().Add(resetTokenTTL)); err != nil {
		log.Printf("password reset: failed to store token for user %d: %v", user.ID, err)
		return
	}

	subject, html := resetPasswordEmailContent(publicBaseURL, token)
	if err := sender.Send(r.Context(), user.Email, subject, html); err != nil {
		log.Printf("password reset: failed to send reset email for user %d: %v", user.ID, err)
	}
}

// RateLimitedRequestPasswordResetHandler envuelve RequestPasswordResetHandler
// limitando solicitudes repetidas por email. Reutiliza LoginRateLimiter,
// mismo patrón que RateLimitedRequestVerificationHandler.
func RateLimitedRequestPasswordResetHandler(userStore UserStore, tokenStore PasswordResetTokenStore, sender email.Sender, publicBaseURL string, limiter *LoginRateLimiter) http.Handler {
	inner := RequestPasswordResetHandler(userStore, tokenStore, sender, publicBaseURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req requestPasswordResetRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Email != "" && !limiter.Allowed(req.Email) {
			writeError(w, http.StatusTooManyRequests, "too many password reset requests, try again later")
			return
		}
		if req.Email != "" {
			limiter.RecordFailure(req.Email)
		}

		inner.ServeHTTP(w, r)
	})
}
