// Package routes persiste rutas grabadas en la app móvil (metadatos, puntos
// GPS y paradas, sin fotos) en la cuenta del usuario autenticado.
package routes

import (
	"context"
	"errors"
)

// MaxPoints es el límite de puntos GPS aceptado por ruta en una subida — del
// orden de un trayecto de un día entero a 1 punto/seg. Evita payloads
// desproporcionados sin necesitar rate limiting dedicado (ver design.md).
const MaxPoints = 50000

// ErrTooManyPoints indica que la ruta supera MaxPoints.
var ErrTooManyPoints = errors.New("route exceeds the maximum number of points")

// ErrRouteOwnedByAnotherUser indica que el id de ruta ya existe en el
// servidor asociado a otra cuenta — nunca se sobrescribe, ni siquiera
// silenciosamente.
var ErrRouteOwnedByAnotherUser = errors.New("route id already belongs to another user")

// Route son los metadatos de una ruta, sin puntos ni paradas (resumen de listado).
type Route struct {
	ID            string  `json:"id"`
	CreatedAt     string  `json:"created_at"`
	Duration      float64 `json:"duration"`
	TotalDistance float64 `json:"total_distance"`
	AvgSpeed      float64 `json:"avg_speed"`
	Status        string  `json:"status"`
	Name          *string `json:"name"`
	Notes         *string `json:"notes"`
	IsFavorite    bool    `json:"is_favorite"`
}

// Point es un punto GPS individual de una ruta. MatchedLat/MatchedLng son la
// versión ajustada a carretera (ver normalizar-y-exportar-rutas) — nil si el
// punto todavía no se ha normalizado.
type Point struct {
	Timestamp  int64    `json:"timestamp"`
	Lat        float64  `json:"lat"`
	Lng        float64  `json:"lng"`
	Alt        float64  `json:"alt"`
	Speed      float64  `json:"speed"`
	MatchedLat *float64 `json:"matched_lat,omitempty"`
	MatchedLng *float64 `json:"matched_lng,omitempty"`
}

// Stop es una parada detectada dentro de una ruta.
type Stop struct {
	StartTime      int64   `json:"start_time"`
	EndTime        *int64  `json:"end_time"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	Type           string  `json:"type"`
	StopCategoryID *int64  `json:"stop_category_id"`
}

// Detail es una ruta completa: metadatos, puntos y paradas.
type Detail struct {
	Route
	Points []Point `json:"points"`
	Stops  []Stop  `json:"stops"`
}

// Store persiste y consulta rutas, siempre acotadas al usuario propietario.
type Store interface {
	// Upsert inserta o actualiza (por Detail.ID) la ruta completa del usuario
	// indicado. Devuelve ErrRouteOwnedByAnotherUser si el id ya existe
	// asociado a otra cuenta, y ErrTooManyPoints si supera MaxPoints.
	Upsert(ctx context.Context, userID int64, route Detail) error
	// ListByUser devuelve solo los resúmenes (sin puntos/paradas) de las
	// rutas del usuario, en orden descendente de creación.
	ListByUser(ctx context.Context, userID int64) ([]Route, error)
	// GetByIDForUser devuelve la ruta completa si pertenece al usuario, o nil
	// si no existe o pertenece a otro usuario (mismo resultado en ambos casos).
	GetByIDForUser(ctx context.Context, userID int64, id string) (*Detail, error)
}
