// Command api arranca el servicio HTTP de Moto Routes.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/achievements"
	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/config"
	"github.com/crzverde/moto-routes/apps/api/internal/email"
	"github.com/crzverde/moto-routes/apps/api/internal/httpmw"
	"github.com/crzverde/moto-routes/apps/api/internal/mapmatch"
	"github.com/crzverde/moto-routes/apps/api/internal/migrate"
	"github.com/crzverde/moto-routes/apps/api/internal/notifications"
	"github.com/crzverde/moto-routes/apps/api/internal/photos"
	"github.com/crzverde/moto-routes/apps/api/internal/ping"
	"github.com/crzverde/moto-routes/apps/api/internal/routes"
	"github.com/crzverde/moto-routes/apps/api/internal/routesharing"
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

// Límite de invitaciones de compartir ruta por email destino: 5 cada 15 minutos.
const (
	routeShareRateLimitMaxAttempts = 5
	routeShareRateLimitWindow      = 15 * time.Minute
)

// mapMatchHTTPTimeout acota cada llamada a OSRM (por bloque de puntos, ver
// internal/mapmatch) — sin timeout explícito, http.DefaultClient no tiene
// límite y una llamada colgada (ej. OSRM caído) bloquearía el upsert de la
// ruta muy por encima de lo que la normalización best-effort debería costar
// (ver design.md de normalizar-y-exportar-rutas, Decisión 6).
const mapMatchHTTPTimeout = 5 * time.Second

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
	deviceTokenStore := notifications.PostgresDeviceTokenStore{Pool: pool}
	notifier := buildNotifier(ctx, cfg.FCMServiceAccountJSON, deviceTokenStore)

	router := chi.NewRouter()
	router.Use(httpmw.Recover)
	router.Get("/api/ping", ping.Handler(ping.PostgresService{Pool: pool}).ServeHTTP)
	router.With(httpmw.PublicCORS).Get("/api/stop-types", stoptypes.Handler(stoptypes.PostgresRepository{Pool: pool}).ServeHTTP)
	loginRateLimiter := auth.NewLoginRateLimiter(loginRateLimitMaxAttempts, loginRateLimitWindow)
	verificationRequestRateLimiter := auth.NewLoginRateLimiter(verificationRequestRateLimitMaxAttempts, verificationRequestRateLimitWindow)
	registerRateLimiter := auth.NewLoginRateLimiter(registerRateLimitMaxAttempts, registerRateLimitWindow)

	// httpmw.PublicCORS en las rutas que apps/mobile llama por fetch() cross-origin
	// (localhost:1420 -> localhost:8080) — gap real encontrado verificando
	// pantallas-auth-mobile contra un navegador de verdad (Cypress), invisible
	// con curl o con las páginas server-rendered de apps/api (mismo origen).
	// Cada una necesita también su propia ruta OPTIONS para el preflight —
	// chi exige registro de método explícito, y el preflight nunca lleva el
	// token de auth, así que va sin auth.RequireAuth.
	router.With(httpmw.PublicCORS).Post("/api/auth/register",
		auth.RateLimitedRegisterHandler(userStore, verificationTokenStore, resendSender, cfg.PublicAPIBaseURL, registerRateLimiter).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/auth/register", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS).Post("/api/auth/login", auth.RateLimitedLoginHandler(userStore, tokenIssuer, loginRateLimiter).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/auth/login", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/auth/me", auth.MeHandler(userStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/auth/me", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS).Post("/api/auth/verify-email/request",
		auth.RateLimitedRequestVerificationHandler(userStore, verificationTokenStore, resendSender, cfg.PublicAPIBaseURL, verificationRequestRateLimiter).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/auth/verify-email/request", func(http.ResponseWriter, *http.Request) {})
	router.Get("/api/auth/verify-email/confirm", auth.ConfirmVerificationHandler(userStore, verificationTokenStore).ServeHTTP)

	passwordResetRateLimiter := auth.NewLoginRateLimiter(passwordResetRateLimitMaxAttempts, passwordResetRateLimitWindow)
	router.With(httpmw.PublicCORS).Post("/api/auth/reset-password/request",
		auth.RateLimitedRequestPasswordResetHandler(userStore, passwordResetTokenStore, resendSender, cfg.PublicAPIBaseURL, passwordResetRateLimiter).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/auth/reset-password/request", func(http.ResponseWriter, *http.Request) {})
	resetPasswordConfirmHandler := auth.ResetPasswordConfirmHandler(userStore, passwordResetTokenStore).ServeHTTP
	router.Get("/api/auth/reset-password/confirm", resetPasswordConfirmHandler)
	router.Post("/api/auth/reset-password/confirm", resetPasswordConfirmHandler)

	routeStore := routes.PostgresRouteStore{Pool: pool}
	if cfg.MapMatchOSRMURL != "" {
		routeStore.Matcher = mapmatch.Client{BaseURL: cfg.MapMatchOSRMURL, HTTPClient: &http.Client{Timeout: mapMatchHTTPTimeout}}
	}
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/routes", routes.UpsertHandler(routeStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/routes", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/routes", routes.ListHandler(routeStore).ServeHTTP)

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/routes/{id}", routes.DetailHandler(routeStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/routes/{id}", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/routes/{id}/export.gpx", routes.GPXExportHandler(routeStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/routes/{id}/export.gpx", func(http.ResponseWriter, *http.Request) {})

	blobStore, err := photos.NewMinioBlobStore(cfg.MinioEndpoint, cfg.MinioAccessKey, cfg.MinioSecretKey, cfg.MinioBucket, false)
	if err != nil {
		log.Fatalf("failed to create MinIO client: %v", err)
	}
	photoStore := photos.PostgresPhotoStore{Pool: pool}
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/routes/{id}/photos", photos.UploadHandler(photoStore, blobStore, cfg.PhotoEncryptionKey).ServeHTTP)
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/routes/{id}/photos", photos.ListHandler(photoStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/routes/{id}/photos", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/routes/{id}/photos/{photoId}", photos.DownloadHandler(photoStore, blobStore, cfg.PhotoEncryptionKey).ServeHTTP)
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Delete("/api/routes/{id}/photos/{photoId}", photos.DeleteHandler(photoStore, blobStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/routes/{id}/photos/{photoId}", func(http.ResponseWriter, *http.Request) {})

	shareStore := routesharing.PostgresRouteShareStore{Pool: pool}
	routeShareRateLimiter := auth.NewLoginRateLimiter(routeShareRateLimitMaxAttempts, routeShareRateLimitWindow)
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/route-shares",
		routesharing.RateLimitedCreateInvitationHandler(shareStore, routeStore, userStore, notifier, routeShareRateLimiter).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/route-shares", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/route-shares/received", routesharing.ListReceivedHandler(shareStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/route-shares/received", func(http.ResponseWriter, *http.Request) {})
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/route-shares/sent", routesharing.ListSentHandler(shareStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/route-shares/sent", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/route-shares/{id}/accept",
		routesharing.AcceptHandler(shareStore, routeStore, photoStore, blobStore).ServeHTTP)
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/route-shares/{id}/decline", routesharing.DeclineHandler(shareStore).ServeHTTP)
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/route-shares/{id}/revoke", routesharing.RevokeHandler(shareStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/route-shares/{id}/accept", func(http.ResponseWriter, *http.Request) {})
	router.With(httpmw.PublicCORS).Options("/api/route-shares/{id}/decline", func(http.ResponseWriter, *http.Request) {})
	router.With(httpmw.PublicCORS).Options("/api/route-shares/{id}/revoke", func(http.ResponseWriter, *http.Request) {})

	achievementStore := achievements.PostgresAchievementStore{Pool: pool}
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/achievements/check", achievements.CheckHandler(achievementStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/achievements/check", func(http.ResponseWriter, *http.Request) {})
	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Get("/api/achievements", achievements.ListHandler(achievementStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/achievements", func(http.ResponseWriter, *http.Request) {})

	router.With(httpmw.PublicCORS, auth.RequireAuth(tokenIssuer)).Post("/api/device-tokens", notifications.RegisterDeviceTokenHandler(deviceTokenStore).ServeHTTP)
	router.With(httpmw.PublicCORS).Options("/api/device-tokens", func(http.ResponseWriter, *http.Request) {})

	log.Printf("listening on %s", cfg.ServerAddress)
	if err := http.ListenAndServe(cfg.ServerAddress, router); err != nil {
		log.Fatal(err)
	}
}

// buildNotifier construye el Notifier real si serviceAccountJSON está
// configurada, o un NoopNotifier si no — las notificaciones push son
// opcionales (ver design.md de notificaciones-push-fcm, Decisión 4), un
// fallo al parsear la credencial no debe impedir arrancar el servidor.
func buildNotifier(ctx context.Context, serviceAccountJSON string, tokenStore notifications.DeviceTokenStore) notifications.Notifier {
	if serviceAccountJSON == "" {
		log.Printf("FCM_SERVICE_ACCOUNT_JSON not set — push notifications disabled")
		return notifications.NoopNotifier{}
	}

	notifier, err := notifications.NewFCMNotifier(ctx, serviceAccountJSON, tokenStore)
	if err != nil {
		log.Printf("failed to initialize FCM notifier, push notifications disabled: %v", err)
		return notifications.NoopNotifier{}
	}
	return notifier
}
