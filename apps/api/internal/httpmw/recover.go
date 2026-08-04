// Package httpmw contiene middleware HTTP transversal, no específico de
// ningún dominio (autenticación, ping, futuros endpoints).
package httpmw

import (
	"encoding/json"
	"log"
	"net/http"
)

type errorResponse struct {
	Error string `json:"error"`
}

// Recover intercepta un pánico no controlado en cualquier handler y responde
// con un error genérico uniforme (nunca traza de pila, ruta de fichero ni
// fragmentos de consulta SQL). El detalle real solo se registra en el log del
// servidor, nunca en la respuesta HTTP.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered: %v", rec)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(errorResponse{Error: "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}
