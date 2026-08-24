// Package userdirectory implementa la búsqueda de usernames por coincidencia
// parcial, usada por el selector de amigos (ver selector-amigos, design.md).
package userdirectory

import (
	"net/http"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
	"github.com/crzverde/moto-routes/apps/api/internal/auth"
)

// searchResultLimit acota cada búsqueda a 10 resultados — reduce el valor de
// cada petición para cosechar usernames en bloque (ver design.md, Decisión).
const searchResultLimit = 10

// SearchHandler busca usernames que contienen el término recibido en `q`.
// Exige sesión activa (RequireAuth); el mínimo de 2 caracteres es solo del
// cliente, aquí basta con una query no vacía.
func SearchHandler(store auth.UserStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := apihttp.RequireUserID(w, r); !ok {
			return
		}

		query := r.URL.Query().Get("q")
		if query == "" {
			apihttp.WriteError(w, http.StatusBadRequest, "q is required")
			return
		}

		usernames, err := store.SearchUsernames(r.Context(), query, searchResultLimit)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if usernames == nil {
			usernames = []string{}
		}

		apihttp.WriteJSON(w, http.StatusOK, usernames)
	})
}
