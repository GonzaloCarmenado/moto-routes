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

// Record cuenta una petición contra el límite de la clave — no implica que
// la petición fallara (una búsqueda nunca falla, solo cuenta contra el
// límite), a diferencia de RecordFailure.
func (l *LoginRateLimiter) Record(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.attempts[key] = append(l.pruneLocked(key), time.Now())
}

// RecordFailure registra un intento fallido para la clave.
func (l *LoginRateLimiter) RecordFailure(key string) {
	l.Record(key)
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
func RateLimitedLoginHandler(store UserStore, issuer TokenIssuer, refreshIssuer RefreshTokenIssuer, limiter *LoginRateLimiter) http.Handler {
	inner := LoginHandler(store, issuer, refreshIssuer)

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

// RateLimitedRefreshHandler envuelve RefreshHandler aplicando el límite de
// intentos fallidos por refresh token antes de procesar la petición — mismo
// patrón que RateLimitedLoginHandler, con el propio valor del refresh token
// como clave (no hay email en esta petición).
func RateLimitedRefreshHandler(store RefreshTokenStore, issuer TokenIssuer, refreshTTL time.Duration, limiter *LoginRateLimiter) http.Handler {
	inner := RefreshHandler(store, issuer, refreshTTL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req refreshRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.RefreshToken != "" && !limiter.Allowed(req.RefreshToken) {
			writeError(w, http.StatusTooManyRequests, "too many refresh attempts, try again later")
			return
		}

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		inner.ServeHTTP(rec, r)

		if req.RefreshToken != "" && rec.status == http.StatusUnauthorized {
			limiter.RecordFailure(req.RefreshToken)
		}
	})
}
