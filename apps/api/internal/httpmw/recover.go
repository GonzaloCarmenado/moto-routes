// Package httpmw contiene middleware HTTP transversal, no específico de
// ningún dominio (autenticación, ping, futuros endpoints).
package httpmw

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

type errorResponse struct {
	Error string `json:"error"`
}

// Recover construye un middleware que intercepta un pánico no controlado en
// cualquier handler y responde con un error genérico uniforme (nunca traza
// de pila, ruta de fichero ni fragmentos de consulta SQL). El detalle real
// se registra en logger (ver openspec/changes/observabilidad-produccion),
// nunca en la respuesta HTTP.
func Recover(logger *opslog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					// Un fallo al registrar el evento no debe impedir responder al panic.
					_ = logger.Record(opslog.Event{
						Timestamp: time.Now().UTC(),
						Level:     opslog.LevelError,
						Kind:      "panic",
						Message:   fmt.Sprintf("panic recovered: %v", rec),
						Route:     r.URL.Path,
						Method:    r.Method,
					})
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(errorResponse{Error: "internal server error"})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
