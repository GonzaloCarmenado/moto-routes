package auth

import (
	"encoding/json"
	"net/http"
)

type meResponse struct {
	ID            int64  `json:"id"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
}

// MeHandler devuelve la cuenta del usuario autenticado por RequireAuth. Sirve
// como endpoint protegido real que ejercita el middleware de autenticación.
func MeHandler(store UserStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
			return
		}

		user, err := store.FindUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, missingOrInvalidTokenMessage)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(meResponse{ID: user.ID, Email: user.Email, EmailVerified: user.EmailVerified})
	})
}
