package routes

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
)

type upsertPointRequest struct {
	Timestamp int64   `json:"timestamp"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Alt       float64 `json:"alt"`
	Speed     float64 `json:"speed"`
}

type upsertStopRequest struct {
	StartTime      int64   `json:"start_time"`
	EndTime        *int64  `json:"end_time"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	Type           string  `json:"type"`
	StopCategoryID *int64  `json:"stop_category_id"`
}

type upsertRequest struct {
	ID            string               `json:"id"`
	CreatedAt     string               `json:"created_at"`
	Duration      float64              `json:"duration"`
	TotalDistance float64              `json:"total_distance"`
	AvgSpeed      float64              `json:"avg_speed"`
	Status        string               `json:"status"`
	Name          *string              `json:"name"`
	Notes         *string              `json:"notes"`
	IsFavorite    bool                 `json:"is_favorite"`
	Points        []upsertPointRequest `json:"points"`
	Stops         []upsertStopRequest  `json:"stops"`
}

type upsertResponse struct {
	ID string `json:"id"`
}

// UpsertHandler crea o actualiza (por id) la ruta completa del usuario
// autenticado. El id de ruta es el mismo UUID generado por el cliente
// (ver design.md, Decisión 1) — nunca se sobrescribe una ruta de otro usuario.
func UpsertHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		var req upsertRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.ID == "" {
			apihttp.WriteError(w, http.StatusBadRequest, "id is required")
			return
		}

		detail := Detail{
			Route: Route{
				ID:            req.ID,
				CreatedAt:     req.CreatedAt,
				Duration:      req.Duration,
				TotalDistance: req.TotalDistance,
				AvgSpeed:      req.AvgSpeed,
				Status:        req.Status,
				Name:          req.Name,
				Notes:         req.Notes,
				IsFavorite:    req.IsFavorite,
			},
			Points: make([]Point, len(req.Points)),
			Stops:  make([]Stop, len(req.Stops)),
		}
		for i, p := range req.Points {
			detail.Points[i] = Point{Timestamp: p.Timestamp, Lat: p.Lat, Lng: p.Lng, Alt: p.Alt, Speed: p.Speed}
		}
		for i, s := range req.Stops {
			detail.Stops[i] = Stop{StartTime: s.StartTime, EndTime: s.EndTime, Lat: s.Lat, Lng: s.Lng, Type: s.Type, StopCategoryID: s.StopCategoryID}
		}

		if err := store.Upsert(r.Context(), userID, detail); err != nil {
			switch err {
			case ErrTooManyPoints:
				apihttp.WriteError(w, http.StatusBadRequest, "route exceeds the maximum number of points")
			case ErrRouteOwnedByAnotherUser:
				apihttp.WriteError(w, http.StatusConflict, "route id already in use")
			default:
				apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			}
			return
		}

		apihttp.WriteJSON(w, http.StatusOK, upsertResponse{ID: req.ID})
	})
}

// ListHandler devuelve los resúmenes de las rutas del usuario autenticado.
func ListHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		list, err := store.ListByUser(r.Context(), userID)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if list == nil {
			list = []Route{}
		}

		apihttp.WriteJSON(w, http.StatusOK, list)
	})
}

// DetailHandler devuelve la ruta completa (puntos+paradas) del usuario
// autenticado. Responde 404 tanto si la ruta no existe como si pertenece a
// otro usuario — nunca revela cuál de los dos casos es.
func DetailHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		id := chi.URLParam(r, "id")
		detail, err := store.GetByIDForUser(r.Context(), userID, id)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if detail == nil {
			apihttp.WriteError(w, http.StatusNotFound, "route not found")
			return
		}

		apihttp.WriteJSON(w, http.StatusOK, detail)
	})
}
