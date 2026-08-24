package sysmetrics

import (
	"fmt"
	"sync"
	"time"

	"github.com/crzverde/moto-routes/apps/api/internal/opslog"
)

// Monitor lee la instantánea de memoria/disco y registra un warning en el
// registro de eventos cuando un recurso cruza el umbral configurado — sin
// repetirlo en lecturas sucesivas mientras el recurso siga por encima, solo
// si vuelve a cruzarlo tras haber bajado (ver spec "Aviso cuando memoria o
// disco superan un umbral crítico").
type Monitor struct {
	path             string
	thresholdPercent float64
	logger           *opslog.Logger

	mu       sync.Mutex
	exceeded map[string]bool // "memory" | "disk" -> ya estaba por encima en la última lectura
}

// NewMonitor construye un Monitor para el fichero de métricas en path.
func NewMonitor(path string, thresholdPercent float64, logger *opslog.Logger) *Monitor {
	return &Monitor{
		path:             path,
		thresholdPercent: thresholdPercent,
		logger:           logger,
		exceeded:         map[string]bool{},
	}
}

// Read lee la instantánea más reciente y comprueba el umbral de cada
// recurso. ok=false si todavía no hay instantánea disponible.
func (m *Monitor) Read() (Snapshot, bool) {
	snap, ok := ReadSnapshot(m.path)
	if !ok {
		return Snapshot{}, false
	}
	m.checkThreshold("memory", snap.Memory)
	m.checkThreshold("disk", snap.Disk)
	return snap, true
}

func (m *Monitor) checkThreshold(resource string, snap ResourceSnapshot) {
	m.mu.Lock()
	defer m.mu.Unlock()

	overThreshold := snap.UsedPercent() > m.thresholdPercent
	wasExceeded := m.exceeded[resource]

	if overThreshold && !wasExceeded {
		_ = m.logger.Record(opslog.Event{
			Timestamp: time.Now().UTC(),
			Level:     opslog.LevelWarning,
			Kind:      "resource_threshold",
			Message:   fmt.Sprintf("%s usage above threshold: %.1f%%", resource, snap.UsedPercent()),
			Fields:    map[string]string{"resource": resource},
		})
	}
	m.exceeded[resource] = overThreshold
}
