// Package stoptypes expone el catálogo de tipos de parada (bar/restaurante,
// mirador, monumento, gasolinera…) que la app móvil usa para categorizar una
// parada manual durante la grabación de una ruta.
package stoptypes

import "context"

// StopType es un tipo de parada del catálogo.
type StopType struct {
	ID    int64  `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

// Repository consulta el catálogo de tipos de parada.
type Repository interface {
	List(ctx context.Context) ([]StopType, error)
}
