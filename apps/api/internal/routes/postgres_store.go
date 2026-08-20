package routes

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/crzverde/moto-routes/apps/api/internal/mapmatch"
)

// insertChunkSize acota cuántas filas lleva cada INSERT multi-valor de
// puntos/paradas, para no acercarse al límite de parámetros por statement de
// PostgreSQL (65535) ni con MaxPoints en un único INSERT.
const insertChunkSize = 500

// Matcher ajusta un conjunto de puntos GPS a la carretera más probable
// (implementado por mapmatch.Client contra un servicio OSRM real). Interfaz
// local para poder sustituirlo por un doble en tests sin acoplar los tests de
// este paquete al transporte HTTP real.
type Matcher interface {
	Match(ctx context.Context, points []mapmatch.Point) ([]*mapmatch.Point, error)
}

// PostgresRouteStore implementa Store contra las tablas routes/route_points/route_stops reales.
type PostgresRouteStore struct {
	Pool *pgxpool.Pool
	// Matcher normaliza los puntos GPS de cada ruta al sincronizarla,
	// best-effort (ver design.md de normalizar-y-exportar-rutas, Decisión 6).
	// nil desactiva la normalización sin afectar al resto del upsert.
	Matcher Matcher
}

// Upsert reemplaza la ruta completa (metadatos + puntos + paradas) del
// usuario indicado, y devuelve los puntos resultantes (con MatchedLat/
// MatchedLng rellenos si el Matcher los ajustó — ver
// actualizar-mapa-tras-normalizacion). El id ya existente ligado a otro
// usuario nunca se sobrescribe: la propia consulta de upsert falla en ese
// caso (Goal de aislamiento estricto, ver design.md).
func (s PostgresRouteStore) Upsert(ctx context.Context, userID int64, route Detail) ([]Point, error) {
	if len(route.Points) > MaxPoints {
		return nil, ErrTooManyPoints
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		INSERT INTO routes (id, user_id, created_at, duration, total_distance, avg_speed, status, name, notes, is_favorite, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (id) DO UPDATE SET
			duration = EXCLUDED.duration,
			total_distance = EXCLUDED.total_distance,
			avg_speed = EXCLUDED.avg_speed,
			status = EXCLUDED.status,
			name = EXCLUDED.name,
			notes = EXCLUDED.notes,
			is_favorite = EXCLUDED.is_favorite,
			updated_at = now()
		WHERE routes.user_id = $2`,
		route.ID, userID, route.CreatedAt, route.Duration, route.TotalDistance, route.AvgSpeed, route.Status, route.Name, route.Notes, route.IsFavorite,
	)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrRouteOwnedByAnotherUser
	}

	if _, err := tx.Exec(ctx, "DELETE FROM route_points WHERE route_id = $1", route.ID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, "DELETE FROM route_stops WHERE route_id = $1", route.ID); err != nil {
		return nil, err
	}

	if err := insertPoints(ctx, tx, route.ID, route.Points); err != nil {
		return nil, err
	}
	if err := insertStops(ctx, tx, route.ID, route.Stops); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if s.Matcher != nil {
		return s.normalizePoints(ctx, route.ID, route.Points), nil
	}
	return route.Points, nil
}

// normalizePoints ajusta los puntos ya guardados de una ruta a la carretera
// más probable, best-effort: un fallo del Matcher (servicio OSRM caído,
// timeout, sin coincidencia) se registra en el log y devuelve los puntos
// originales sin ajuste — la ruta ya está guardada con sus puntos originales
// (ver design.md, Decisión 6). Devuelve los puntos resultantes (originales o
// ajustados) para que el llamador los propague en la respuesta de
// sincronización.
func (s PostgresRouteStore) normalizePoints(ctx context.Context, routeID string, points []Point) []Point {
	if len(points) == 0 {
		return points
	}

	input := make([]mapmatch.Point, len(points))
	for i, p := range points {
		input[i] = mapmatch.Point{Lat: p.Lat, Lng: p.Lng}
	}

	adjusted, err := s.Matcher.Match(ctx, input)
	if err != nil {
		log.Printf("routes: map-matching failed for route %s: %v", routeID, err)
		return points
	}

	result := make([]Point, len(points))
	copy(result, points)
	for i, a := range adjusted {
		if a == nil {
			continue
		}
		if _, err := s.Pool.Exec(ctx,
			"UPDATE route_points SET matched_lat = $1, matched_lng = $2 WHERE route_id = $3 AND timestamp = $4",
			a.Lat, a.Lng, routeID, points[i].Timestamp,
		); err != nil {
			log.Printf("routes: failed to persist matched point for route %s: %v", routeID, err)
			continue
		}
		result[i].MatchedLat = &a.Lat
		result[i].MatchedLng = &a.Lng
	}
	return result
}

func insertPoints(ctx context.Context, tx pgx.Tx, routeID string, points []Point) error {
	for start := 0; start < len(points); start += insertChunkSize {
		end := min(start+insertChunkSize, len(points))
		chunk := points[start:end]

		placeholders := make([]string, 0, len(chunk))
		args := make([]any, 0, len(chunk)*6)
		for i, p := range chunk {
			base := i * 6
			placeholders = append(placeholders, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d,$%d)", base+1, base+2, base+3, base+4, base+5, base+6))
			args = append(args, routeID, p.Timestamp, p.Lat, p.Lng, p.Alt, p.Speed)
		}

		query := "INSERT INTO route_points (route_id, timestamp, lat, lng, alt, speed) VALUES " + strings.Join(placeholders, ", ")
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			return err
		}
	}
	return nil
}

func insertStops(ctx context.Context, tx pgx.Tx, routeID string, stops []Stop) error {
	for start := 0; start < len(stops); start += insertChunkSize {
		end := min(start+insertChunkSize, len(stops))
		chunk := stops[start:end]

		placeholders := make([]string, 0, len(chunk))
		args := make([]any, 0, len(chunk)*7)
		for i, st := range chunk {
			base := i * 7
			placeholders = append(placeholders, fmt.Sprintf("($%d,$%d,$%d,$%d,$%d,$%d,$%d)", base+1, base+2, base+3, base+4, base+5, base+6, base+7))
			args = append(args, routeID, st.StartTime, st.EndTime, st.Lat, st.Lng, st.Type, st.StopCategoryID)
		}

		query := "INSERT INTO route_stops (route_id, start_time, end_time, lat, lng, type, stop_category_id) VALUES " + strings.Join(placeholders, ", ")
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			return err
		}
	}
	return nil
}

// ListByUser devuelve solo los resúmenes (sin puntos/paradas) de las rutas del usuario.
func (s PostgresRouteStore) ListByUser(ctx context.Context, userID int64) ([]Route, error) {
	rows, err := s.Pool.Query(ctx,
		"SELECT id, created_at, duration, total_distance, avg_speed, status, name, notes, is_favorite FROM routes WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	routeList := []Route{}
	for rows.Next() {
		var r Route
		if err := rows.Scan(&r.ID, &r.CreatedAt, &r.Duration, &r.TotalDistance, &r.AvgSpeed, &r.Status, &r.Name, &r.Notes, &r.IsFavorite); err != nil {
			return nil, err
		}
		routeList = append(routeList, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return routeList, nil
}

// GetByIDForUser devuelve la ruta completa si pertenece al usuario, o nil si
// no existe o pertenece a otro usuario.
func (s PostgresRouteStore) GetByIDForUser(ctx context.Context, userID int64, id string) (*Detail, error) {
	var detail Detail
	err := s.Pool.QueryRow(ctx,
		"SELECT id, created_at, duration, total_distance, avg_speed, status, name, notes, is_favorite FROM routes WHERE id = $1 AND user_id = $2",
		id, userID,
	).Scan(&detail.ID, &detail.CreatedAt, &detail.Duration, &detail.TotalDistance, &detail.AvgSpeed, &detail.Status, &detail.Name, &detail.Notes, &detail.IsFavorite)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	points, err := s.listPoints(ctx, id)
	if err != nil {
		return nil, err
	}
	stops, err := s.listStops(ctx, id)
	if err != nil {
		return nil, err
	}
	detail.Points = points
	detail.Stops = stops

	return &detail, nil
}

func (s PostgresRouteStore) listPoints(ctx context.Context, routeID string) ([]Point, error) {
	rows, err := s.Pool.Query(ctx,
		"SELECT timestamp, lat, lng, alt, speed, matched_lat, matched_lng FROM route_points WHERE route_id = $1 ORDER BY timestamp ASC",
		routeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []Point{}
	for rows.Next() {
		var p Point
		if err := rows.Scan(&p.Timestamp, &p.Lat, &p.Lng, &p.Alt, &p.Speed, &p.MatchedLat, &p.MatchedLng); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

func (s PostgresRouteStore) listStops(ctx context.Context, routeID string) ([]Stop, error) {
	rows, err := s.Pool.Query(ctx,
		"SELECT start_time, end_time, lat, lng, type, stop_category_id FROM route_stops WHERE route_id = $1 ORDER BY start_time ASC",
		routeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stops := []Stop{}
	for rows.Next() {
		var st Stop
		if err := rows.Scan(&st.StartTime, &st.EndTime, &st.Lat, &st.Lng, &st.Type, &st.StopCategoryID); err != nil {
			return nil, err
		}
		stops = append(stops, st)
	}
	return stops, rows.Err()
}
