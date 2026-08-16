package achievements

import (
	"encoding/json"
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

type errorResponse struct {
	Error string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorResponse{Error: message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func requireUserID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or invalid token")
		return 0, false
	}
	return userID, true
}

// CheckHandler comprueba y otorga los logros que el usuario autenticado
// cumple, devolviendo solo los recién otorgados en esta llamada — es lo que
// el cliente usa para disparar la animación de desbloqueo (ver design.md
// Decisión 3, spec "Comprobación de logros tras sincronización").
func CheckHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := requireUserID(w, r)
		if !ok {
			return
		}

		granted, err := store.CheckAndGrant(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if granted == nil {
			granted = []Achievement{}
		}

		writeJSON(w, http.StatusOK, granted)
	})
}

// ListHandler devuelve el catálogo completo con el estado del usuario
// autenticado para cada logro — conseguidos con su fecha, pendientes con el
// progreso actual — para la pantalla "Mis logros".
func ListHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := requireUserID(w, r)
		if !ok {
			return
		}

		progress, err := store.ListWithProgress(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if progress == nil {
			progress = []Progress{}
		}

		writeJSON(w, http.StatusOK, progress)
	})
}
