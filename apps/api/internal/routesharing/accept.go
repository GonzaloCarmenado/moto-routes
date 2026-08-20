package routesharing

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
	"github.com/crzverde/moto-routes/apps/api/internal/photos"
	"github.com/crzverde/moto-routes/apps/api/internal/routes"
)

// errSourceRouteNotFound indica que, en el momento de aceptar, la ruta
// origen de la invitación ya no existe para su emisor — no debería ocurrir
// hoy (no hay borrado de rutas server-side todavía), pero se trata como
// cualquier otro fallo interno, nunca como "no encontrado" de la invitación
// en sí (esa comprobación ya la hizo MarkAccepted).
var errSourceRouteNotFound = errors.New("source route no longer exists")

type acceptResponse struct {
	RouteID string `json:"route_id"`
}

// AcceptHandler acepta una invitación pendiente del usuario autenticado y
// clona la ruta origen completa (metadatos, puntos, paradas y fotos) como
// una ruta nueva e independiente en su cuenta (design.md D4) — sin ningún
// vínculo posterior con la original. Responde 404 tanto si la invitación no
// existe como si no le pertenece o ya no está pendiente (design.md D6,
// delegado en MarkAccepted).
func AcceptHandler(shareStore Store, routeStore routes.Store, photoStore photos.PhotoStore, blobStore photos.BlobStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}
		invitationID := chi.URLParam(r, "id")

		inv, err := shareStore.MarkAccepted(r.Context(), userID, invitationID)
		if err != nil {
			writeShareStoreError(w, err)
			return
		}

		newRouteID, err := cloneRoute(r.Context(), routeStore, photoStore, blobStore, inv)
		if err != nil {
			log.Printf("route sharing: failed to clone route %s for invitation %s: %v", inv.RouteID, inv.ID, err)
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		apihttp.WriteJSON(w, http.StatusOK, acceptResponse{RouteID: newRouteID})
	})
}

// cloneRoute copia los metadatos, puntos y paradas de la ruta origen como
// una ruta nueva del destinatario (reutilizando routes.Store.Upsert, sin
// SQL nuevo), con is_favorite siempre false (design.md D5), y a
// continuación sus fotos (clonePhotos). Devuelve el id de la ruta clonada.
func cloneRoute(ctx context.Context, routeStore routes.Store, photoStore photos.PhotoStore, blobStore photos.BlobStore, inv Invitation) (string, error) {
	source, err := routeStore.GetByIDForUser(ctx, inv.FromUserID, inv.RouteID)
	if err != nil {
		return "", err
	}
	if source == nil {
		return "", errSourceRouteNotFound
	}

	cloned := *source
	cloned.ID = uuid.NewString()
	cloned.IsFavorite = false

	if _, err := routeStore.Upsert(ctx, inv.ToUserID, cloned); err != nil {
		return "", err
	}

	if err := clonePhotos(ctx, photoStore, blobStore, inv.FromUserID, inv.ToUserID, inv.RouteID, cloned.ID); err != nil {
		return "", err
	}

	return cloned.ID, nil
}

// clonePhotos copia el blob cifrado de cada foto de la ruta origen a un
// ObjectKey nuevo bajo la ruta clonada, sin descifrar ni recifrar — la
// clave de cifrado es única para toda la instalación (ver design.md,
// Context), así que el ciphertext es válido tal cual bajo el nuevo id.
func clonePhotos(ctx context.Context, photoStore photos.PhotoStore, blobStore photos.BlobStore, fromUserID, toUserID int64, sourceRouteID, newRouteID string) error {
	sourcePhotos, err := photoStore.ListByRoute(ctx, fromUserID, sourceRouteID)
	if err != nil {
		return err
	}

	for _, p := range sourcePhotos {
		ciphertext, err := blobStore.Get(ctx, p.ObjectKey)
		if err != nil {
			return err
		}

		cloned := p
		cloned.ID = uuid.NewString()
		cloned.RouteID = newRouteID
		cloned.ObjectKey = "routes/" + newRouteID + "/" + cloned.ID

		if err := blobStore.Put(ctx, cloned.ObjectKey, ciphertext); err != nil {
			return err
		}
		if _, err := photoStore.Create(ctx, toUserID, cloned); err != nil {
			return err
		}
	}
	return nil
}
