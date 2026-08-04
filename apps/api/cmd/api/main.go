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
	"github.com/crzverde/moto-routes/apps/api/internal/httpmw"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
	"github.com/crzverde/moto-routes/apps/api/internal/ping"
)

// tokenTTL es la duración de validez de un token de sesión emitido en login.
const tokenTTL = 24 * time.Hour

// Límite de intentos de login fallidos por email: 5 intentos cada 15 minutos.
const (
	loginRateLimitMaxAttempts = 5
	loginRateLimitWindow      = 15 * time.Minute
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
	tokenIssuer := auth.TokenIssuer{Secret: cfg.TokenSigningKey, TTL: tokenTTL}

	router := chi.NewRouter()
	router.Use(httpmw.Recover)
	router.Get("/api/ping", ping.Handler(ping.PostgresService{Pool: pool}).ServeHTTP)
	loginRateLimiter := auth.NewLoginRateLimiter(loginRateLimitMaxAttempts, loginRateLimitWindow)

	router.Post("/api/auth/register", auth.RegisterHandler(userStore).ServeHTTP)
	router.Post("/api/auth/login", auth.RateLimitedLoginHandler(userStore, tokenIssuer, loginRateLimiter).ServeHTTP)
	router.With(auth.RequireAuth(tokenIssuer)).Get("/api/auth/me", auth.MeHandler(userStore).ServeHTTP)

	log.Printf("listening on %s", cfg.ServerAddress)
	if err := http.ListenAndServe(cfg.ServerAddress, router); err != nil {
		log.Fatal(err)
	}
}
