package auth

import (
	"encoding/json"
	"net/http"
)

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// LogoutHandler revoca el refresh token del propio dispositivo (ver spec
// delta de user-auth, renovacion-token-sesion) — se monta detrás de
// RequireAuth, así que solo una sesión con access token todavía válido puede
// llamarlo. Nunca falla visiblemente: un token ya revocado, inexistente o
// ausente en el body responden igual con éxito, porque el logout siempre
// debe completarse desde el punto de vista del usuario.
func LogoutHandler(store RefreshTokenStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req logoutRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.RefreshToken != "" {
			_ = store.Revoke(r.Context(), hashOneTimeToken(req.RefreshToken))
		}

		w.WriteHeader(http.StatusOK)
	})
}
