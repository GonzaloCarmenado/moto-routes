package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userIDContextKey contextKey = "userID"

const missingOrInvalidTokenMessage = "missing or invalid token"

// RequireAuth exige un token de sesión válido y no expirado en la cabecera
// Authorization (Bearer). Rechaza la petición si falta, está mal formado, ha
// expirado o su firma no es válida.
func RequireAuth(issuer TokenIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok || token == "" {
				writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
				return
			}

			userID, err := issuer.Verify(token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
				return
			}

			ctx := context.WithValue(r.Context(), userIDContextKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext recupera el id de usuario dejado por RequireAuth.
func UserIDFromContext(ctx context.Context) (int64, bool) {
	userID, ok := ctx.Value(userIDContextKey).(int64)
	return userID, ok
}
