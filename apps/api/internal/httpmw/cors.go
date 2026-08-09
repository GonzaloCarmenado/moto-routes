package httpmw

import "net/http"

// PublicCORS añade las cabeceras CORS necesarias para que el WebView de
// apps/mobile (`http://localhost:1420` en desarrollo, `tauri://localhost` en
// producción) pueda llamar a `apps/api` (`http://localhost:8080` / host de
// Tailscale) desde JavaScript — sin esto, el navegador bloquea la petición
// cross-origin en silencio: el fetch nunca llega a lanzar, pero el navegador
// descarta la respuesta antes de entregársela al JS que la pidió.
//
// Gap real encontrado tres veces: primero con `GET /api/stop-types` (sin body
// ni headers custom, ADR-035), después con los `POST`/`GET` de auth — que
// además disparan un preflight `OPTIONS` (no cubierto por la versión
// original de este middleware, que solo ponía `Access-Control-Allow-Origin`
// y nunca respondía explícitamente a `OPTIONS`) — y una tercera vez con el
// `DELETE` de fotos (subida-fotos-mobile): `Access-Control-Allow-Methods`
// nunca incluyó `DELETE`, así que el preflight lo rechazaba antes de que la
// petición real llegara a la red. Invisible con `curl` directo (sin
// preflight) y con Cypress (su navegador no aplica CORS con el mismo rigor
// que un WebView Android real) — solo se vio verificando contra un
// dispositivo real.
//
// Origen comodín ("*") también en endpoints autenticados con Bearer token
// (`/api/auth/me`), a diferencia de lo que decía el comentario original de
// este fichero ("no usar en endpoints autenticados"): eso aplica a
// autenticación por cookie, que el navegador adjunta automáticamente y por
// eso un origen comodín sí sería peligroso combinado con credenciales. Un
// token en la cabecera `Authorization` nunca lo adjunta el navegador solo —
// solo viaja si el propio JS que hizo la petición lo puso ahí a propósito,
// así que un origen distinto no puede "montarse" en la sesión de otro. Este
// proyecto no usa auth por cookie en ningún endpoint.
func PublicCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
