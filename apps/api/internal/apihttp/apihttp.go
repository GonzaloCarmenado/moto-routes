// Package apihttp centraliza los helpers de respuesta HTTP (JSON de éxito,
// JSON de error, extracción del usuario autenticado) que antes estaban
// copiados byte a byte en cada paquete de handlers (achievements, routes,
// routesharing, photos) — ver design.md Decisión 2 de auditoria-tecnica-2026-08.
// internal/auth no forma parte de esta extracción: sus handlers responden a
// veces antes de tener un usuario autenticado (registro, login, reset de
// contraseña), así que no comparten RequireUserID con el resto.
package apihttp

import (
	"encoding/json"
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type errorResponse struct {
	Error string `json:"error"`
}

// WriteError escribe una respuesta JSON de error con el status indicado.
func WriteError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorResponse{Error: message})
}

// WriteJSON escribe body como JSON con el status indicado.
func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// RequireUserID extrae el id de usuario dejado por auth.RequireAuth en el
// contexto de la petición. Si falta (el middleware no se aplicó o el token
// no era válido), escribe un 401 y devuelve ok=false.
func RequireUserID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		WriteError(w, http.StatusUnauthorized, "missing or invalid token")
		return 0, false
	}
	return userID, true
}
