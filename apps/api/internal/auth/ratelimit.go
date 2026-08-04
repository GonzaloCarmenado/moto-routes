package auth

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

// LoginRateLimiter cuenta intentos de login fallidos por email dentro de una
// ventana de tiempo, para mitigar ataques de fuerza bruta. Un único proceso,
// en memoria: se pierde al reiniciar y no se comparte entre réplicas (ver
// ADR-034 — aceptado mientras el servicio sea una sola instancia).
type LoginRateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	max      int
	window   time.Duration
}

// NewLoginRateLimiter crea un limitador que permite hasta max intentos
// fallidos por clave dentro de window.
func NewLoginRateLimiter(max int, window time.Duration) *LoginRateLimiter {
	return &LoginRateLimiter{attempts: map[string][]time.Time{}, max: max, window: window}
}

// Allowed indica si la clave todavía puede intentar login dentro de la ventana.
func (l *LoginRateLimiter) Allowed(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.pruneLocked(key)) < l.max
}

// RecordFailure registra un intento fallido para la clave.
func (l *LoginRateLimiter) RecordFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.attempts[key] = append(l.pruneLocked(key), time.Now())
}

func (l *LoginRateLimiter) pruneLocked(key string) []time.Time {
	cutoff := time.Now().Add(-l.window)
	kept := l.attempts[key][:0]
	for _, t := range l.attempts[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.attempts, key)
		return nil
	}
	l.attempts[key] = kept
	return kept
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// RateLimitedLoginHandler envuelve LoginHandler aplicando el límite de
// intentos fallidos por email antes de procesar la petición.
func RateLimitedLoginHandler(store UserStore, issuer TokenIssuer, limiter *LoginRateLimiter) http.Handler {
	inner := LoginHandler(store, issuer)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req loginRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Email != "" && !limiter.Allowed(req.Email) {
			writeError(w, http.StatusTooManyRequests, "too many failed login attempts, try again later")
			return
		}

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		inner.ServeHTTP(rec, r)

		if req.Email != "" && rec.status == http.StatusUnauthorized {
			limiter.RecordFailure(req.Email)
		}
	})
}
