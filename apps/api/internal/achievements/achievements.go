// Package achievements calcula agregados de progreso por usuario (km
// totales, rutas grabadas, km del mes natural en curso, duración de la ruta
// más larga) sobre rutas ya sincronizadas, y otorga de forma idempotente los
// logros del catálogo cuyo umbral se cumple (ver design.md de sistema-logros).
package achievements

import "context"

// RequirementType es el tipo de requisito que debe cumplir el agregado
// correspondiente del usuario para que un logro se otorgue.
type RequirementType string

const (
	RequirementTotalDistanceKM        RequirementType = "total_distance_km"
	RequirementMonthlyDistanceKM      RequirementType = "monthly_distance_km"
	RequirementRouteCount             RequirementType = "route_count"
	RequirementSingleRouteDurationSec RequirementType = "single_route_duration_seconds"
)

// Achievement es una fila del catálogo (ver design.md Decisión 1).
type Achievement struct {
	ID              int64           `json:"id"`
	Key             string          `json:"key"`
	RequirementType RequirementType `json:"requirement_type"`
	Threshold       float64         `json:"threshold"`
	Title           string          `json:"title"`
	Description     string          `json:"description"`
	Icon            string          `json:"icon"`
}

// Aggregates son los agregados de progreso de un usuario, calculados sobre
// rutas ya sincronizadas (ver design.md Decisión 4).
type Aggregates struct {
	TotalDistanceKM     float64
	RouteCount          int64
	LongestRouteSeconds float64
	MonthDistanceKM     float64
}

// Progress es el estado de un logro para un usuario: otorgado (con fecha) o
// pendiente (con el valor actual del agregado relevante para su tipo).
type Progress struct {
	Achievement Achievement `json:"achievement"`
	AchievedAt  *string     `json:"achieved_at"`
	Current     float64     `json:"current"`
}

// Store calcula agregados y otorga logros de forma idempotente.
type Store interface {
	// Aggregates calcula los agregados de progreso del usuario sobre sus
	// rutas ya sincronizadas.
	Aggregates(ctx context.Context, userID int64) (Aggregates, error)
	// CheckAndGrant evalúa el catálogo completo contra los agregados
	// actuales del usuario y otorga (idempotente) los logros que se cumplen
	// y que el usuario todavía no tenía. Devuelve solo los logros otorgados
	// en esta llamada, nunca los ya otorgados en llamadas anteriores.
	CheckAndGrant(ctx context.Context, userID int64) ([]Achievement, error)
	// ListWithProgress devuelve el catálogo completo con el estado del
	// usuario para cada logro — usado por la pantalla "Mis logros".
	ListWithProgress(ctx context.Context, userID int64) ([]Progress, error)
}

// currentValue devuelve, para un tipo de requisito, el agregado que le
// corresponde comparar contra el umbral.
func currentValue(reqType RequirementType, agg Aggregates) float64 {
	switch reqType {
	case RequirementTotalDistanceKM:
		return agg.TotalDistanceKM
	case RequirementMonthlyDistanceKM:
		return agg.MonthDistanceKM
	case RequirementRouteCount:
		return float64(agg.RouteCount)
	case RequirementSingleRouteDurationSec:
		return agg.LongestRouteSeconds
	default:
		return 0
	}
}
