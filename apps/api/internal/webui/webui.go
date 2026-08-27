// Package webui sirve el build estático de apps/web (el panel de reporting)
// empotrado en el propio binario — mismo origen que /api/*, sin CORS (ver
// dashboard-reporting, design.md Decisión 1). dist/ es un placeholder
// committeado (ver ese directorio); el Dockerfile de producción lo
// sobrescribe con el build real de apps/web antes de compilar.
package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed dist
var distFS embed.FS

// Handler sirve el contenido de dist/ bajo prefix, con fallback a index.html
// para cualquier ruta que no sea un fichero real del build — el router de
// cliente (SPA) de apps/web resuelve esas rutas en el navegador, no en el
// servidor.
func Handler(prefix string) http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		// dist/ siempre existe (placeholder committeado) — un error aquí solo
		// puede significar que el propio binario está corrupto.
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.StripPrefix(prefix, spaFallback(sub, fileServer))
}

// spaFallback reescribe la petición a "/" (index.html) cuando el path
// solicitado no corresponde a ningún fichero real del build.
func spaFallback(fsys fs.FS, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(fsys, path); err != nil {
			r = cloneWithRootPath(r)
		}
		next.ServeHTTP(w, r)
	})
}

// cloneWithRootPath devuelve una copia superficial de r con URL.Path "/" —
// http.StripPrefix ya se aplicó antes de spaFallback, así que "/" resuelve a
// index.html en el http.FileServer envuelto.
func cloneWithRootPath(r *http.Request) *http.Request {
	clone := r.Clone(r.Context())
	clone.URL.Path = "/"
	return clone
}
