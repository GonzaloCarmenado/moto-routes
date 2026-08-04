package httpmw

import "net/http"

// PublicCORS añade `Access-Control-Allow-Origin: *` a un handler público sin
// autenticación ni credenciales — hoy solo GET /api/stop-types (catálogo de
// referencia no sensible, ver stoptypes.Handler). Sin esto, el navegador
// bloquea silenciosamente la petición cross-origin desde el WebView de
// apps/mobile (`http://localhost:1420` en desarrollo, `tauri://localhost` en
// producción) contra `apps/api` (`http://localhost:8080` / host de Tailscale),
// distinto origen — el fetch nunca llega a lanzar, pero el navegador
// descarta la respuesta antes de entregársela al JS que la pidió.
// No usar en endpoints autenticados: un origen comodín nunca debe
// combinarse con credenciales/cookies.
func PublicCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		next.ServeHTTP(w, r)
	})
}
