package userdirectory

import (
	"net/http"
	"strconv"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

// RateLimitedSearchHandler envuelve SearchHandler acotando cuántas búsquedas
// hace una cuenta por unidad de tiempo — clave = userID autenticado, a
// diferencia de LoginRateLimiter en login/refresh (clave = el dato sobre el
// que se actúa), porque aquí lo que hay que acotar es la actividad de la
// cuenta, no ningún dato de la petición (ver design.md).
func RateLimitedSearchHandler(store auth.UserStore, limiter *auth.LoginRateLimiter) http.Handler {
	inner := SearchHandler(store)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		key := strconv.FormatInt(userID, 10)
		if !limiter.Allowed(key) {
			apihttp.WriteError(w, http.StatusTooManyRequests, "too many searches, try again later")
			return
		}
		limiter.Record(key)

		inner.ServeHTTP(w, r)
	})
}
