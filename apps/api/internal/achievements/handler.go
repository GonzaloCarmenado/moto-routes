package achievements

import (
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
)

// CheckHandler comprueba y otorga los logros que el usuario autenticado
// cumple, devolviendo solo los recién otorgados en esta llamada — es lo que
// el cliente usa para disparar la animación de desbloqueo (ver design.md
// Decisión 3, spec "Comprobación de logros tras sincronización").
func CheckHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		granted, err := store.CheckAndGrant(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if granted == nil {
			granted = []Achievement{}
		}

		apihttp.WriteJSON(w, http.StatusOK, granted)
	})
}

// ListHandler devuelve el catálogo completo con el estado del usuario
// autenticado para cada logro — conseguidos con su fecha, pendientes con el
// progreso actual — para la pantalla "Mis logros".
func ListHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		progress, err := store.ListWithProgress(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if progress == nil {
			progress = []Progress{}
		}

		apihttp.WriteJSON(w, http.StatusOK, progress)
	})
}
