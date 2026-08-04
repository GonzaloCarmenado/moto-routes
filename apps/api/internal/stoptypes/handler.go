package stoptypes

import (
	"encoding/json"
	"net/http"
)

// Handler expone el catálogo de tipos de parada. Es el único endpoint de
// apps/api sin autenticación además de /api/ping: dato de referencia no
// sensible, sin fricción de login para leerlo.
func Handler(repo Repository) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		types, err := repo.List(r.Context())
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "could not process the request"})
			return
		}
		if types == nil {
			types = []StopType{}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(types)
	})
}
