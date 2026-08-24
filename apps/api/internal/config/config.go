// Package config lee la configuración de apps/api exclusivamente de variables
// de entorno — ningún secreto ni cadena de conexión vive en código versionado.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/crzverde/moto-routes/apps/api/internal/photos"
)

// Valores por defecto del registro de eventos y de las métricas de host (ver
// openspec/changes/observabilidad-produccion) cuando su variable de entorno
// no está fijada — ninguno de los dos es un secreto.
const (
	defaultEventsLogPath                  = "events.jsonl"
	defaultEventsLogMaxSizeBytes    int64 = 10 * 1024 * 1024
	defaultSysMetricsPath                 = "sysmetrics.json"
	defaultSysMetricsAlertThreshold       = 90.0
)

// Config es la configuración de arranque del servicio.
type Config struct {
	// DatabaseURL es el DSN de PostgreSQL (postgres://user:pass@host:port/db).
	DatabaseURL string
	// ServerAddress es la dirección host:puerto en la que escucha el servidor HTTP.
	ServerAddress string
	// TokenSigningKey firma los tokens de sesión (JWT). Es un secreto: sin valor por defecto.
	TokenSigningKey []byte
	// ResendAPIKey autentica las llamadas a la API de Resend. Es un secreto: sin valor por defecto.
	ResendAPIKey string
	// ResendFromAddress es el remitente ("Nombre <direccion@dominio>") de los emails enviados vía Resend.
	ResendFromAddress string
	// PublicAPIBaseURL es la URL pública y absoluta (https://) desde la que
	// se construyen los enlaces de verificación de email. Debe empezar por
	// https:// — una URL relativa o sin esquema causó el incidente de
	// ADR-036 con MOBILE_PROD_API_BASE_URL; aquí se rechaza en el arranque.
	PublicAPIBaseURL string
	// MinioEndpoint es host:puerto del servidor MinIO (sin esquema).
	MinioEndpoint string
	// MinioAccessKey/MinioSecretKey autentican contra MinIO. Secretos: sin valor por defecto.
	MinioAccessKey string
	MinioSecretKey string
	// MinioBucket es el bucket donde se guardan las fotos de ruta.
	MinioBucket string
	// PhotoEncryptionKey cifra/descifra las fotos de ruta (AES-256-GCM, ver
	// internal/photos). Es un secreto: sin valor por defecto, nunca vive
	// junto a los datos que cifra (MinIO).
	PhotoEncryptionKey []byte
	// FCMServiceAccountJSON es el JSON de la cuenta de servicio de Firebase
	// usada para enviar notificaciones push. Opcional (a diferencia de
	// ResendAPIKey): sin ella, el envío queda no-op — el badge in-app sigue
	// siendo la fuente de verdad (ver design.md de notificaciones-push-fcm,
	// Decisión 4). Es un secreto cuando está presente.
	FCMServiceAccountJSON string
	// MapMatchOSRMURL es la URL base de un servicio OSRM propio (ej.
	// http://osrm:5000) usado para ajustar a carretera los puntos GPS de una
	// ruta al sincronizarla (ver normalizar-y-exportar-rutas). Opcional, igual
	// que FCMServiceAccountJSON: sin ella, la normalización queda
	// desactivada (best-effort) — no hace falta un servicio OSRM real para
	// desarrollar en local.
	MapMatchOSRMURL string
	// AdminStatusToken autentica el endpoint admin de observabilidad
	// (registro-errores-api) — secreto propio, distinto del JWT de un
	// usuario normal y de DATABASE_URL (ver design.md de
	// observabilidad-produccion, Decisión 3). Es un secreto: sin valor por
	// defecto.
	AdminStatusToken string
	// ResendWebhookSecret verifica la firma (esquema Svix) de los eventos de
	// fallo de entrega que envía Resend. Es un secreto: sin valor por
	// defecto.
	ResendWebhookSecret string
	// EventsLogPath es la ruta del fichero JSONL donde se registran los
	// eventos de error/warning. Opcional: por defecto un fichero relativo,
	// adecuado para desarrollo local; en producción se fija a una ruta
	// dentro del volumen montado.
	EventsLogPath string
	// EventsLogMaxSizeBytes acota el tamaño del fichero de eventos — al
	// superarlo se descartan los más antiguos (ver design.md Decisión 1).
	// Opcional: 10 MiB por defecto.
	EventsLogMaxSizeBytes int64
	// SysMetricsPath es la ruta del fichero JSON con la última instantánea
	// de memoria/disco del host, escrito por un script externo (ver
	// design.md Decisión 2). Opcional: por defecto un fichero relativo.
	SysMetricsPath string
	// SysMetricsAlertThresholdPercent es el porcentaje de uso (memoria o
	// disco) a partir del cual se registra un warning. Opcional: 90% por
	// defecto.
	SysMetricsAlertThresholdPercent float64
}

// Load lee la configuración desde variables de entorno. DATABASE_URL,
// AUTH_TOKEN_SECRET, RESEND_API_KEY, RESEND_FROM_ADDRESS y
// PUBLIC_API_BASE_URL son obligatorias y sin valor por defecto. SERVER_ADDRESS
// por defecto es 0.0.0.0 para no romper el entorno local; en producción se
// fija a la interfaz de Tailscale del servidor.
func Load() (Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, errors.New("DATABASE_URL environment variable is required")
	}

	tokenSecret := os.Getenv("AUTH_TOKEN_SECRET")
	if tokenSecret == "" {
		return Config{}, errors.New("AUTH_TOKEN_SECRET environment variable is required")
	}

	resendAPIKey := os.Getenv("RESEND_API_KEY")
	if resendAPIKey == "" {
		return Config{}, errors.New("RESEND_API_KEY environment variable is required")
	}

	resendFromAddress := os.Getenv("RESEND_FROM_ADDRESS")
	if resendFromAddress == "" {
		return Config{}, errors.New("RESEND_FROM_ADDRESS environment variable is required")
	}

	publicAPIBaseURL := os.Getenv("PUBLIC_API_BASE_URL")
	if publicAPIBaseURL == "" {
		return Config{}, errors.New("PUBLIC_API_BASE_URL environment variable is required")
	}
	if !strings.HasPrefix(publicAPIBaseURL, "https://") {
		return Config{}, errors.New("PUBLIC_API_BASE_URL must start with https://")
	}

	host := os.Getenv("SERVER_ADDRESS")
	if host == "" {
		host = "0.0.0.0"
	}

	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		return Config{}, errors.New("MINIO_ENDPOINT environment variable is required")
	}
	minioAccessKey := os.Getenv("MINIO_ACCESS_KEY")
	if minioAccessKey == "" {
		return Config{}, errors.New("MINIO_ACCESS_KEY environment variable is required")
	}
	minioSecretKey := os.Getenv("MINIO_SECRET_KEY")
	if minioSecretKey == "" {
		return Config{}, errors.New("MINIO_SECRET_KEY environment variable is required")
	}
	minioBucket := os.Getenv("MINIO_BUCKET")
	if minioBucket == "" {
		return Config{}, errors.New("MINIO_BUCKET environment variable is required")
	}

	photoEncryptionKeyEncoded := os.Getenv("PHOTO_ENCRYPTION_KEY")
	if photoEncryptionKeyEncoded == "" {
		return Config{}, errors.New("PHOTO_ENCRYPTION_KEY environment variable is required")
	}
	photoEncryptionKey, err := photos.DecodeKey(photoEncryptionKeyEncoded)
	if err != nil {
		return Config{}, fmt.Errorf("invalid PHOTO_ENCRYPTION_KEY: %w", err)
	}

	adminStatusToken := os.Getenv("ADMIN_STATUS_TOKEN")
	if adminStatusToken == "" {
		return Config{}, errors.New("ADMIN_STATUS_TOKEN environment variable is required")
	}

	resendWebhookSecret := os.Getenv("RESEND_WEBHOOK_SECRET")
	if resendWebhookSecret == "" {
		return Config{}, errors.New("RESEND_WEBHOOK_SECRET environment variable is required")
	}

	eventsLogPath := os.Getenv("EVENTS_LOG_PATH")
	if eventsLogPath == "" {
		eventsLogPath = defaultEventsLogPath
	}

	eventsLogMaxSizeBytes := defaultEventsLogMaxSizeBytes
	if raw := os.Getenv("EVENTS_LOG_MAX_SIZE_BYTES"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || parsed <= 0 {
			return Config{}, errors.New("EVENTS_LOG_MAX_SIZE_BYTES must be a positive integer")
		}
		eventsLogMaxSizeBytes = parsed
	}

	sysMetricsPath := os.Getenv("SYSMETRICS_PATH")
	if sysMetricsPath == "" {
		sysMetricsPath = defaultSysMetricsPath
	}

	sysMetricsAlertThreshold := defaultSysMetricsAlertThreshold
	if raw := os.Getenv("SYSMETRICS_ALERT_THRESHOLD_PERCENT"); raw != "" {
		parsed, err := strconv.ParseFloat(raw, 64)
		if err != nil || parsed <= 0 || parsed > 100 {
			return Config{}, errors.New("SYSMETRICS_ALERT_THRESHOLD_PERCENT must be a number between 0 and 100")
		}
		sysMetricsAlertThreshold = parsed
	}

	return Config{
		DatabaseURL:                     dbURL,
		ServerAddress:                   host + ":8080",
		TokenSigningKey:                 []byte(tokenSecret),
		ResendAPIKey:                    resendAPIKey,
		ResendFromAddress:               resendFromAddress,
		PublicAPIBaseURL:                publicAPIBaseURL,
		MinioEndpoint:                   minioEndpoint,
		MinioAccessKey:                  minioAccessKey,
		MinioSecretKey:                  minioSecretKey,
		MinioBucket:                     minioBucket,
		PhotoEncryptionKey:              photoEncryptionKey,
		FCMServiceAccountJSON:           os.Getenv("FCM_SERVICE_ACCOUNT_JSON"),
		MapMatchOSRMURL:                 os.Getenv("MAPMATCH_OSRM_URL"),
		AdminStatusToken:                adminStatusToken,
		ResendWebhookSecret:             resendWebhookSecret,
		EventsLogPath:                   eventsLogPath,
		EventsLogMaxSizeBytes:           eventsLogMaxSizeBytes,
		SysMetricsPath:                  sysMetricsPath,
		SysMetricsAlertThresholdPercent: sysMetricsAlertThreshold,
	}, nil
}
