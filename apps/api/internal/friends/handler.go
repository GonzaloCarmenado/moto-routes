package friends

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
)

type createRequestRequest struct {
	Username string `json:"username"`
}

type genericMessageResponse struct {
	Message string `json:"message"`
}

const requestCreatedMessage = "if the account exists and no relationship already exists, a friend request has been sent"

// CreateRequestHandler crea una solicitud de amistad. Responde siempre el
// mismo mensaje genérico, exista o no la cuenta destino, sea o no elegible
// la solicitud (propio username, ya amigos, ya pendiente) — nunca revela en
// la respuesta cuál de los casos fue (mismo criterio que
// routesharing.CreateInvitationHandler; el rechazo de "propio username" se
// hace también en cliente antes de llegar aquí, ver design.md).
func CreateRequestHandler(store Store, userStore auth.UserStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		var req createRequestRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Username == "" {
			apihttp.WriteError(w, http.StatusBadRequest, "username is required")
			return
		}

		tryCreateFriendRequest(r.Context(), store, userStore, userID, req.Username)

		apihttp.WriteJSON(w, http.StatusOK, genericMessageResponse{Message: requestCreatedMessage})
	})
}

// tryCreateFriendRequest intenta crear la solicitud, pero nunca comunica al
// llamador si lo consiguió — cualquier fallo (username inexistente, propio
// username, ya amigos o solicitud ya pendiente) resulta silenciosamente en
// no crear nada, sin distinguir el motivo.
func tryCreateFriendRequest(ctx context.Context, store Store, userStore auth.UserStore, requesterID int64, username string) {
	addressee, err := userStore.FindUserByUsername(ctx, username)
	if err != nil {
		return
	}

	if _, err := store.Create(ctx, requesterID, addressee.ID); err != nil {
		if !errors.Is(err, ErrCannotFriendSelf) && !errors.Is(err, ErrAlreadyFriendsOrPending) {
			log.Printf("friends: failed to create request from user %d to %s: %v", requesterID, username, err)
		}
		return
	}
}

// RateLimitedCreateRequestHandler envuelve CreateRequestHandler limitando
// solicitudes repetidas al mismo username en poco tiempo — mismo patrón que
// routesharing.RateLimitedCreateInvitationHandler.
func RateLimitedCreateRequestHandler(store Store, userStore auth.UserStore, limiter *auth.LoginRateLimiter) http.Handler {
	inner := CreateRequestHandler(store, userStore)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var req createRequestRequest
		_ = json.Unmarshal(rawBody, &req)

		if req.Username != "" && !limiter.Allowed(req.Username) {
			apihttp.WriteError(w, http.StatusTooManyRequests, "too many friend requests sent to this username, try again later")
			return
		}
		if req.Username != "" {
			limiter.RecordFailure(req.Username)
		}

		inner.ServeHTTP(w, r)
	})
}

// ListReceivedHandler devuelve las solicitudes pendientes recibidas por el
// usuario autenticado.
func ListReceivedHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		received, err := store.ListReceivedPending(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if received == nil {
			received = []ReceivedRequest{}
		}

		apihttp.WriteJSON(w, http.StatusOK, received)
	})
}

// ListSentHandler devuelve las solicitudes enviadas por el usuario autenticado.
func ListSentHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		sent, err := store.ListSent(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if sent == nil {
			sent = []SentRequest{}
		}

		apihttp.WriteJSON(w, http.StatusOK, sent)
	})
}

// ListFriendsHandler devuelve los amigos ya aceptados del usuario autenticado.
func ListFriendsHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		friends, err := store.ListAccepted(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if friends == nil {
			friends = []Friend{}
		}

		apihttp.WriteJSON(w, http.StatusOK, friends)
	})
}

// AcceptHandler acepta una solicitud pendiente del usuario autenticado —
// solo cambia el estado de la fila, sin ningún dato adicional que clonar
// (ver design.md, a diferencia de routesharing.AcceptHandler).
func AcceptHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		requestID := chi.URLParam(r, "id")

		if _, err := store.MarkAccepted(r.Context(), userID, requestID); err != nil {
			writeFriendStoreError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

// DeclineHandler rechaza una solicitud pendiente del usuario autenticado.
// Responde 404 tanto si no existe como si no le pertenece o ya no está
// pendiente — nunca revela cuál de los casos es.
func DeclineHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		requestID := chi.URLParam(r, "id")

		if err := store.MarkDeclined(r.Context(), userID, requestID); err != nil {
			writeFriendStoreError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

// RevokeHandler revoca una solicitud pendiente enviada por el usuario
// autenticado. Mismo criterio 404 que DeclineHandler.
func RevokeHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		requestID := chi.URLParam(r, "id")

		if err := store.MarkRevoked(r.Context(), userID, requestID); err != nil {
			writeFriendStoreError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

func writeFriendStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrFriendRequestNotFound) {
		apihttp.WriteError(w, http.StatusNotFound, "friend request not found")
		return
	}
	apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
}
