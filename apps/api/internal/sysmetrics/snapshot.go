// Package sysmetrics lee la última instantánea de memoria/disco del host de
// producción, escrita por un script externo al proceso de la API (ver
// design.md de observabilidad-produccion, Decisión 2 — el contenedor de la
// API no ve el disco/memoria reales del host bajo network_mode: host, y no
// se monta /proc ni / del host dentro del contenedor para no revertir el
// hardening no-root de ADR-041).
package sysmetrics

import (
	"encoding/json"
	"os"
	"time"
)

// ResourceSnapshot es el estado de un recurso del host (memoria o disco) en
// un instante dado.
type ResourceSnapshot struct {
	UsedBytes  int64 `json:"usedBytes"`
	TotalBytes int64 `json:"totalBytes"`
}

// UsedPercent devuelve el porcentaje de uso; 0 si TotalBytes no es positivo
// (evita una división por cero antes de la primera medición real).
func (s ResourceSnapshot) UsedPercent() float64 {
	if s.TotalBytes <= 0 {
		return 0
	}
	return float64(s.UsedBytes) / float64(s.TotalBytes) * 100
}

// Snapshot es el contenido del fichero JSON escrito por el script de host.
type Snapshot struct {
	Timestamp time.Time        `json:"timestamp"`
	Memory    ResourceSnapshot `json:"memory"`
	Disk      ResourceSnapshot `json:"disk"`
}

// ReadSnapshot lee la instantánea desde path. ok=false si el fichero todavía
// no existe (antes de la primera recolección) o está corrupto — en ningún
// caso devuelve un error que rompa al llamador, ver spec "Instantánea
// todavía no disponible".
func ReadSnapshot(path string) (Snapshot, bool) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Snapshot{}, false
	}
	var snap Snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return Snapshot{}, false
	}
	return snap, true
}
