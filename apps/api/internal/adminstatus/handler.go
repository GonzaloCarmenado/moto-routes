// Package adminstatus expone el endpoint administrativo de observabilidad
// (registro-errores-api, metricas-recursos-servidor, alertas-fallos-email) —
// ver openspec/changes/observabilidad-produccion.
package adminstatus

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
	"github.com/crzverde/moto-routes/apps/api/internal/sysmetrics"
)

// defaultEventLimit acota cuántos eventos recientes devuelve el endpoint —
// ver spec "Consulta de eventos recientes", escenario "Volumen alto de eventos".
const defaultEventLimit = 200

// MetricsReader lee la última instantánea conocida de memoria/disco del
// host — implementada por *sysmetrics.Monitor; una interfaz propia aquí solo
// para poder sustituirla en tests.
type MetricsReader interface {
	Read() (sysmetrics.Snapshot, bool)
}

type response struct {
	Events           []opslog.Event               `json:"events"`
	Memory           *sysmetrics.ResourceSnapshot `json:"memory,omitempty"`
	Disk             *sysmetrics.ResourceSnapshot `json:"disk,omitempty"`
	MetricsTimestamp *time.Time                   `json:"metricsTimestamp,omitempty"`
}

// Handler devuelve los eventos operacionales más recientes y la última
// instantánea de memoria/disco del host (ausente si aún no hay ninguna
// recolección, ver spec "Instantánea todavía no disponible"), protegido por
// un secreto propio (token, no un JWT de usuario ni las credenciales de
// Postgres — ver design.md Decisión 3) comparado en tiempo constante.
func Handler(logger *opslog.Logger, token string, metrics MetricsReader) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r, token) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		resp := response{Events: logger.Recent(defaultEventLimit)}
		if snap, ok := metrics.Read(); ok {
			memory := snap.Memory
			disk := snap.Disk
			ts := snap.Timestamp
			resp.Memory = &memory
			resp.Disk = &disk
			resp.MetricsTimestamp = &ts
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})
}

// authorized compara en tiempo constante (crypto/subtle) el token recibido
// contra el configurado, para no filtrar por temporización cuánto del
// secreto coincide.
func authorized(r *http.Request, token string) bool {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	provided := strings.TrimPrefix(header, prefix)
	return subtle.ConstantTimeCompare([]byte(provided), []byte(token)) == 1
}
