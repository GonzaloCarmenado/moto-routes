package opslog

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// Logger registra eventos como líneas JSON append-only en disco, acotado a
// un tamaño máximo — ver design.md §1 (fichero JSONL en vez de memoria o
// Postgres, para que un panic que reinicia el proceso no se lleve por
// delante el propio evento que lo causó; tamaño acotado para que una ráfaga
// de errores no agote el disco del servidor).
type Logger struct {
	mu           sync.Mutex
	path         string
	maxSizeBytes int64
	events       []Event // orden cronológico, más antiguo primero
}

// Open abre (o crea) el registro en path, recuperando los eventos ya
// existentes — así sobreviven a un reinicio del proceso (deploy o crash).
func Open(path string, maxSizeBytes int64) (*Logger, error) {
	l := &Logger{path: path, maxSizeBytes: maxSizeBytes}

	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return l, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open events log: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var ev Event
		if err := json.Unmarshal(line, &ev); err != nil {
			continue // línea corrupta: se ignora, no impide arrancar
		}
		l.events = append(l.events, ev)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read events log: %w", err)
	}
	return l, nil
}

// Record añade un evento nuevo, descartando los más antiguos si hace falta
// para mantener el registro dentro de maxSizeBytes.
func (l *Logger) Record(ev Event) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.events = append(l.events, ev)
	l.trimLocked()
	return l.flushLocked()
}

// Recent devuelve hasta limit eventos, del más reciente al más antiguo. Un
// limit <= 0 devuelve todos los eventos disponibles.
func (l *Logger) Recent(limit int) []Event {
	l.mu.Lock()
	defer l.mu.Unlock()

	n := len(l.events)
	if limit > 0 && limit < n {
		n = limit
	}
	result := make([]Event, n)
	for i := 0; i < n; i++ {
		result[i] = l.events[len(l.events)-1-i]
	}
	return result
}

// trimLocked descarta los eventos más antiguos hasta que el tamaño
// serializado total quepa en maxSizeBytes. l.mu debe estar ya tomado.
func (l *Logger) trimLocked() {
	if l.maxSizeBytes <= 0 {
		return
	}
	for len(l.events) > 1 && l.sizeLocked() > l.maxSizeBytes {
		l.events = l.events[1:]
	}
}

func (l *Logger) sizeLocked() int64 {
	var total int64
	for _, ev := range l.events {
		b, err := json.Marshal(ev)
		if err != nil {
			continue
		}
		total += int64(len(b)) + 1 // +1 por el salto de línea
	}
	return total
}

// flushLocked reescribe el fichero completo con el contenido actual de
// l.events, con un rename atómico para no dejarlo a medias si el proceso
// muere a mitad de escritura. l.mu debe estar ya tomado.
func (l *Logger) flushLocked() error {
	tmpPath := l.path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create temp events log: %w", err)
	}

	w := bufio.NewWriter(f)
	for _, ev := range l.events {
		b, err := json.Marshal(ev)
		if err != nil {
			continue
		}
		if _, err := w.Write(b); err != nil {
			f.Close()
			return fmt.Errorf("write event: %w", err)
		}
		if err := w.WriteByte('\n'); err != nil {
			f.Close()
			return fmt.Errorf("write event separator: %w", err)
		}
	}
	if err := w.Flush(); err != nil {
		f.Close()
		return fmt.Errorf("flush events log: %w", err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close temp events log: %w", err)
	}
	if err := os.Rename(tmpPath, l.path); err != nil {
		return fmt.Errorf("replace events log: %w", err)
	}
	return nil
}
