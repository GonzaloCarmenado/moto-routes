package routesharing

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/notifications"
	"github.com/crzverde/moto-routes/apps/api/internal/routes"
)

// routeShareInviteEvent es el tipo de evento de notificaciones-push-fcm
// disparado al crear una invitación — el payload transportado es opaco
// (solo IDs), ver specs/notificaciones-push/spec.md.
const routeShareInviteEvent = "route_share_invite"

type createInvitationRequest struct {
	RouteID string `json:"route_id"`
	Email   string `json:"email"`
}

type genericMessageResponse struct {
	Message string `json:"message"`
}

const invitationCreatedMessage = "if the route is eligible and the account exists, an invitation has been sent"

// CreateInvitationHandler crea una invitación de compartir. Responde siempre
// el mismo mensaje genérico, exista o no la cuenta destino, sea o no
// elegible la ruta — nunca revela en la respuesta cuál de los casos fue
// (ver design.md D2, mismo criterio que RequestPasswordResetHandler).
func CreateInvitationHandler(shareStore Store, routeStore routes.Store, userStore auth.UserStore, notifier notifications.Notifier) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		var req createInvitationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.RouteID == "" || req.Email == "" {
			apihttp.WriteError(w, http.StatusBadRequest, "route_id and email are required")
			return
		}

		tryCreateInvitation(r.Context(), shareStore, routeStore, userStore, notifier, userID, req.RouteID, req.Email)

		apihttp.WriteJSON(w, http.StatusOK, genericMessageResponse{Message: invitationCreatedMessage})
	})
}

// tryCreateInvitation intenta crear la invitación, pero nunca comunica al
// llamador si lo consiguió — cualquier fallo (ruta no elegible, cuenta
// inexistente o no verificada, invitando al propio email) resulta
// silenciosamente en no crear nada, sin distinguir el motivo.
//
// El envío de la notificación push es best-effort *síncrono* (no en una
// goroutine, a diferencia de lo previsto en tasks.md 3.2): la invitación ya
// está creada en ese punto, así que un fallo de Send nunca la deshace ni
// cambia la respuesta HTTP — solo se registra en el log. Se mantiene síncrono
// por consistencia con el resto de la función (que ya hace 3 llamadas
// bloqueantes) y porque así es determinísticamente testeable sin
// sincronización adicional; el coste de latencia real es el de un POST HTTP
// a FCM, aceptable para una acción de baja frecuencia como compartir una ruta.
func tryCreateInvitation(ctx context.Context, shareStore Store, routeStore routes.Store, userStore auth.UserStore, notifier notifications.Notifier, fromUserID int64, routeID, email string) {
	route, err := routeStore.GetByIDForUser(ctx, fromUserID, routeID)
	if err != nil {
		log.Printf("route sharing: failed to look up route %s: %v", routeID, err)
		return
	}
	if route == nil {
		return
	}

	toUser, err := userStore.FindUserByEmail(ctx, email)
	if err != nil {
		return
	}
	if !toUser.EmailVerified {
		return
	}

	invitation, err := shareStore.Create(ctx, routeID, fromUserID, toUser.ID)
	if err != nil {
		if !errors.Is(err, ErrCannotShareWithSelf) {
			log.Printf("route sharing: failed to create invitation for route %s: %v", routeID, err)
		}
		return
	}

	// Payload opaco: solo IDs, nunca el nombre de la ruta ni el email de
	// ninguna cuenta (ver specs/notificaciones-push/spec.md).
	if err := notifier.Send(ctx, toUser.ID, routeShareInviteEvent, map[string]string{
		"invitation_id": invitation.ID,
		"route_id":      routeID,
	}); err != nil {
		log.Printf("route sharing: failed to send push notification for invitation %s: %v", invitation.ID, err)
	}
}

// RateLimitedCreateInvitationHandler envuelve CreateInvitationHandler
// limitando invitaciones repetidas al mismo email en poco tiempo — mismo
// patrón que RateLimitedRequestPasswordResetHandler.
func RateLimitedCreateInvitationHandler(shareStore Store, routeStore routes.Store, userStore auth.UserStore, notifier notifications.Notifier, limiter *auth.LoginRateLimiter) http.Handler {
	inner := CreateInvitationHandler(shareStore, routeStore, userStore, notifier)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req createInvitationRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Email != "" && !limiter.Allowed(req.Email) {
			apihttp.WriteError(w, http.StatusTooManyRequests, "too many invitations sent to this email, try again later")
			return
		}
		if req.Email != "" {
			limiter.RecordFailure(req.Email)
		}

		inner.ServeHTTP(w, r)
	})
}

// ListReceivedHandler devuelve las invitaciones pendientes recibidas por el
// usuario autenticado.
func ListReceivedHandler(shareStore Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		received, err := shareStore.ListReceivedPending(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if received == nil {
			received = []ReceivedInvitation{}
		}

		apihttp.WriteJSON(w, http.StatusOK, received)
	})
}

// ListSentHandler devuelve las invitaciones enviadas por el usuario autenticado.
func ListSentHandler(shareStore Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		sent, err := shareStore.ListSentByUser(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if sent == nil {
			sent = []SentInvitation{}
		}

		apihttp.WriteJSON(w, http.StatusOK, sent)
	})
}

// DeclineHandler rechaza una invitación pendiente del usuario autenticado.
// Responde 404 tanto si no existe como si no le pertenece o ya no está
// pendiente — nunca revela cuál de los casos es (ver design.md D6).
func DeclineHandler(shareStore Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		invitationID := chi.URLParam(r, "id")

		if err := shareStore.MarkDeclined(r.Context(), userID, invitationID); err != nil {
			writeShareStoreError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

// RevokeHandler revoca una invitación pendiente enviada por el usuario
// autenticado. Mismo criterio 404 que DeclineHandler.
func RevokeHandler(shareStore Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		invitationID := chi.URLParam(r, "id")

		if err := shareStore.MarkRevoked(r.Context(), userID, invitationID); err != nil {
			writeShareStoreError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

func writeShareStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrInvitationNotFound) {
		apihttp.WriteError(w, http.StatusNotFound, "invitation not found")
		return
	}
	apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
}
