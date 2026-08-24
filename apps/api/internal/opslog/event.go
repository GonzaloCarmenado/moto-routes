// Package opslog registra y consulta eventos operacionales de apps/api en
// producción (errores, warnings, fallos de entrega de email) — ver
// openspec/changes/observabilidad-produccion.
package opslog

import "time"

// Level es la severidad de un Event.
type Level string

const (
	LevelError   Level = "error"
	LevelWarning Level = "warning"
)

// Event es un registro operacional único: un panic recuperado, una respuesta
// 5xx, un aviso de degradación, o un fallo de entrega de email.
type Event struct {
	Timestamp  time.Time         `json:"timestamp"`
	Level      Level             `json:"level"`
	Kind       string            `json:"kind,omitempty"`
	Message    string            `json:"message"`
	Route      string            `json:"route,omitempty"`
	Method     string            `json:"method,omitempty"`
	StatusCode int               `json:"statusCode,omitempty"`
	Fields     map[string]string `json:"fields,omitempty"`
}
