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

// verificationTokenTTL es cuánto tiempo es válido un token de verificación
// de email antes de caducar.
const verificationTokenTTL = 24 * time.Hour

type requestVerificationRequest struct {
	Email string `json:"email"`
}

type requestVerificationResponse struct {
	Message string `json:"message"`
}

const verificationRequestedMessage = "if an account exists for this email, a verification email has been sent"

// RequestVerificationHandler solicita (o reenvía) un email de verificación.
// Responde con el mismo resultado exista o no una cuenta con ese email, y
// tanto si ya estaba verificada como si no, para no habilitar enumeración de
// cuentas (ver spec de email-verification).
func RequestVerificationHandler(userStore UserStore, tokenStore VerificationTokenStore, sender email.Sender, publicBaseURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req requestVerificationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := userStore.FindUserByEmail(r.Context(), req.Email)
		if err == nil && !user.EmailVerified {
			issueAndSendVerificationToken(r, tokenStore, sender, publicBaseURL, user)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(requestVerificationResponse{Message: verificationRequestedMessage})
	})
}

// issueAndSendVerificationToken genera un token nuevo (invalidando cualquier
// token sin usar anterior), lo persiste hasheado y envía el email best-effort
// — un fallo no debe filtrarse en la respuesta genérica (ver Risks en
// design.md), pero sí queda registrado en el log del servidor para poder
// diagnosticarlo (nunca el token en claro, solo el id de usuario y el error).
func issueAndSendVerificationToken(r *http.Request, tokenStore VerificationTokenStore, sender email.Sender, publicBaseURL string, user StoredUser) {
	token, err := generateOneTimeToken()
	if err != nil {
		log.Printf("email verification: failed to generate token for user %d: %v", user.ID, err)
		return
	}

	if err := tokenStore.CreateToken(r.Context(), user.ID, hashOneTimeToken(token), time.Now().Add(verificationTokenTTL)); err != nil {
		log.Printf("email verification: failed to store token for user %d: %v", user.ID, err)
		return
	}

	subject, html := verificationEmailContent(publicBaseURL, token)
	if err := sender.Send(r.Context(), user.Email, subject, html); err != nil {
		log.Printf("email verification: failed to send verification email for user %d: %v", user.ID, err)
	}
}

// RateLimitedRequestVerificationHandler envuelve RequestVerificationHandler
// limitando solicitudes repetidas por email. Reutiliza LoginRateLimiter (ver
// design.md): es genérico por clave string pese a su nombre, y aquí se
// registra cada intento (no solo los fallidos) porque la respuesta siempre
// es un éxito genérico y no hay forma de distinguir "fallo" por el status.
func RateLimitedRequestVerificationHandler(userStore UserStore, tokenStore VerificationTokenStore, sender email.Sender, publicBaseURL string, limiter *LoginRateLimiter) http.Handler {
	inner := RequestVerificationHandler(userStore, tokenStore, sender, publicBaseURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req requestVerificationRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Email != "" && !limiter.Allowed(req.Email) {
			writeError(w, http.StatusTooManyRequests, "too many verification requests, try again later")
			return
		}
		if req.Email != "" {
			limiter.RecordFailure(req.Email)
		}

		inner.ServeHTTP(w, r)
	})
}
