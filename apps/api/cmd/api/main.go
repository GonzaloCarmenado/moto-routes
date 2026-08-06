// Command api arranca el servicio HTTP de Moto Routes.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/config"
	"github.com/crzverde/moto-routes/apps/api/internal/email"
	"github.com/crzverde/moto-routes/apps/api/internal/httpmw"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
	"github.com/crzverde/moto-routes/apps/api/internal/ping"
	"github.com/crzverde/moto-routes/apps/api/internal/stoptypes"
)

// tokenTTL es la duración de validez de un token de sesión emitido en login.
const tokenTTL = 24 * time.Hour

// Límite de intentos de login fallidos por email: 5 intentos cada 15 minutos.
const (
	loginRateLimitMaxAttempts = 5
	loginRateLimitWindow      = 15 * time.Minute
)

// Límite de solicitudes de verificación de email por dirección: 3 cada 15 minutos.
const (
	verificationRequestRateLimitMaxAttempts = 3
	verificationRequestRateLimitWindow      = 15 * time.Minute
)

// Límite de intentos de registro por email: 5 cada 15 minutos (register ahora
// también llama a un proveedor de email externo con cuota limitada).
const (
	registerRateLimitMaxAttempts = 5
	registerRateLimitWindow      = 15 * time.Minute
)

// Límite de solicitudes de reset de contraseña por email: 3 cada 15 minutos.
const (
	passwordResetRateLimitMaxAttempts = 3
	passwordResetRateLimitWindow      = 15 * time.Minute
)

// dbConnectTimeout acota cuánto espera cada intento de conexión a PostgreSQL
// (incluida la resolución DNS) antes de fallar. Sin este límite, un Postgres
// caído puede tardar varios segundos en devolver el 503 de /api/ping en vez
// de fallar rápido.
const dbConnectTimeout = 3 * time.Second

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("invalid DATABASE_URL: %v", err)
	}
	poolConfig.ConnConfig.ConnectTimeout = dbConnectTimeout

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("failed to create database pool: %v", err)
	}
	defer pool.Close()

	if err := migrate.Run(ctx, pool, migrate.Migrations); err != nil {
		log.Fatalf("failed to apply migrations: %v", err)
	}

	userStore := auth.PostgresUserStore{Pool: pool}
	verificationTokenStore := auth.PostgresVerificationTokenStore{Pool: pool}
	passwordResetTokenStore := auth.PostgresPasswordResetTokenStore{Pool: pool}
	tokenIssuer := auth.TokenIssuer{Secret: cfg.TokenSigningKey, TTL: tokenTTL}
	resendSender := email.ResendSender{APIKey: cfg.ResendAPIKey, From: cfg.ResendFromAddress}

	router := chi.NewRouter()
	router.Use(httpmw.Recover)
	router.Get("/api/ping", ping.Handler(ping.PostgresService{Pool: pool}).ServeHTTP)
	router.With(httpmw.PublicCORS).Get("/api/stop-types", stoptypes.Handler(stoptypes.PostgresRepository{Pool: pool}).ServeHTTP)
	loginRateLimiter := auth.NewLoginRateLimiter(loginRateLimitMaxAttempts, loginRateLimitWindow)
	verificationRequestRateLimiter := auth.NewLoginRateLimiter(verificationRequestRateLimitMaxAttempts, verificationRequestRateLimitWindow)
	registerRateLimiter := auth.NewLoginRateLimiter(registerRateLimitMaxAttempts, registerRateLimitWindow)

	router.Post("/api/auth/register",
		auth.RateLimitedRegisterHandler(userStore, verificationTokenStore, resendSender, cfg.PublicAPIBaseURL, registerRateLimiter).ServeHTTP)
	router.Post("/api/auth/login", auth.RateLimitedLoginHandler(userStore, tokenIssuer, loginRateLimiter).ServeHTTP)
	router.With(auth.RequireAuth(tokenIssuer)).Get("/api/auth/me", auth.MeHandler(userStore).ServeHTTP)
	router.Post("/api/auth/verify-email/request",
		auth.RateLimitedRequestVerificationHandler(userStore, verificationTokenStore, resendSender, cfg.PublicAPIBaseURL, verificationRequestRateLimiter).ServeHTTP)
	router.Get("/api/auth/verify-email/confirm", auth.ConfirmVerificationHandler(userStore, verificationTokenStore).ServeHTTP)

	passwordResetRateLimiter := auth.NewLoginRateLimiter(passwordResetRateLimitMaxAttempts, passwordResetRateLimitWindow)
	router.Post("/api/auth/reset-password/request",
		auth.RateLimitedRequestPasswordResetHandler(userStore, passwordResetTokenStore, resendSender, cfg.PublicAPIBaseURL, passwordResetRateLimiter).ServeHTTP)
	resetPasswordConfirmHandler := auth.ResetPasswordConfirmHandler(userStore, passwordResetTokenStore).ServeHTTP
	router.Get("/api/auth/reset-password/confirm", resetPasswordConfirmHandler)
	router.Post("/api/auth/reset-password/confirm", resetPasswordConfirmHandler)

	log.Printf("listening on %s", cfg.ServerAddress)
	if err := http.ListenAndServe(cfg.ServerAddress, router); err != nil {
		log.Fatal(err)
	}
}
