package ping

import (
	"context"
	"encoding/json"
	"net/http"
)

// Service comprueba la conectividad real con la base de datos.
type Service interface {
	Ping(ctx context.Context) Result
}

// Handler expone Service como un http.Handler: 200 si la base de datos respondió,
// 503 si no, nunca deja la petición colgada indefinidamente.
func Handler(svc Service) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		result := svc.Ping(r.Context())

		status := http.StatusOK
		if !result.Healthy {
			status = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(result)
	})
}
