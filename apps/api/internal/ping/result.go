// Package ping verifica la conectividad real con PostgreSQL, en vez de asumir
// que el proceso arrancado implica que la base de datos está accesible.
package ping

import "time"

// Result es el resultado de la comprobación de conectividad. DatabaseTime solo
// se rellena cuando la consulta tuvo éxito, para que un valor no estático deje
// constancia real de que la base de datos respondió.
type Result struct {
	Healthy      bool       `json:"healthy"`
	DatabaseTime *time.Time `json:"databaseTime"`
	Error        *string    `json:"error"`
}

// Healthy construye un resultado sano a partir del valor real leído de la base de datos.
func Healthy(databaseTime time.Time) Result {
	return Result{Healthy: true, DatabaseTime: &databaseTime}
}

// Unhealthy construye un resultado de fallo con el mensaje del error de conectividad.
func Unhealthy(errMsg string) Result {
	return Result{Healthy: false, Error: &errMsg}
}
