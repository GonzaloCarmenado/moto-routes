package httpmw

import (
	"net/http"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

// CaptureErrors construye un middleware que registra en logger cualquier
// respuesta con código 5xx — cobertura transversal (ver
// openspec/changes/observabilidad-produccion): cualquier endpoint montado
// bajo este middleware queda cubierto sin necesitar código de captura
// propio. Usa el ResponseWriter envolvente que ya trae go-chi/chi/v5
// (chimw.WrapResponseWriter) para leer el código de estado final sin
// reimplementar un http.ResponseWriter propio.
func CaptureErrors(logger *opslog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)

			if ww.Status() >= http.StatusInternalServerError {
				_ = logger.Record(opslog.Event{
					Timestamp:  time.Now().UTC(),
					Level:      opslog.LevelError,
					Kind:       "http_error",
					Message:    "server error response",
					Route:      r.URL.Path,
					Method:     r.Method,
					StatusCode: ww.Status(),
				})
			}
		})
	}
}
