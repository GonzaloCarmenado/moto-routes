// Package config lee la configuración de apps/api exclusivamente de variables
// de entorno — ningún secreto ni cadena de conexión vive en código versionado.
package config

import (
	"errors"
	"os"
)

// Config es la configuración de arranque del servicio.
type Config struct {
	// DatabaseURL es el DSN de PostgreSQL (postgres://user:pass@host:port/db).
	DatabaseURL string
	// ServerAddress es la dirección host:puerto en la que escucha el servidor HTTP.
	ServerAddress string
	// TokenSigningKey firma los tokens de sesión (JWT). Es un secreto: sin valor por defecto.
	TokenSigningKey []byte
}

// Load lee la configuración desde variables de entorno. DATABASE_URL y
// AUTH_TOKEN_SECRET son obligatorias y sin valor por defecto (contienen
// secretos). SERVER_ADDRESS por defecto es 0.0.0.0 para no romper el entorno
// local; en producción se fija a la interfaz de Tailscale del servidor.
func Load() (Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, errors.New("DATABASE_URL environment variable is required")
	}

	tokenSecret := os.Getenv("AUTH_TOKEN_SECRET")
	if tokenSecret == "" {
		return Config{}, errors.New("AUTH_TOKEN_SECRET environment variable is required")
	}

	host := os.Getenv("SERVER_ADDRESS")
	if host == "" {
		host = "0.0.0.0"
	}

	return Config{
		DatabaseURL:     dbURL,
		ServerAddress:   host + ":8080",
		TokenSigningKey: []byte(tokenSecret),
	}, nil
}
