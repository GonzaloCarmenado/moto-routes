package notifications

import (
	"encoding/json"
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
)

type registerTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

// defaultPlatform se usa cuando el cliente no indica plataforma — este
// proyecto solo tiene target Android (ADR-018), pero el campo queda explícito
// por si algún día hay otra.
const defaultPlatform = "android"

// RegisterDeviceTokenHandler registra (o reasigna) el token de notificaciones
// del dispositivo del usuario autenticado.
func RegisterDeviceTokenHandler(store DeviceTokenStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		var req registerTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Token == "" {
			apihttp.WriteError(w, http.StatusBadRequest, "token is required")
			return
		}
		platform := req.Platform
		if platform == "" {
			platform = defaultPlatform
		}

		if err := store.Upsert(r.Context(), userID, req.Token, platform); err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "failed to register device token")
			return
		}

		apihttp.WriteJSON(w, http.StatusOK, map[string]string{"status": "registered"})
	})
}
