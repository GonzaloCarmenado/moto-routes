package routes

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// insertChunkSize acota cuántas filas lleva cada INSERT multi-valor de
// puntos/paradas, para no acercarse al límite de parámetros por statement de
// PostgreSQL (65535) ni con MaxPoints en un único INSERT.
const insertChunkSize = 500

// PostgresRouteStore implementa Store contra las tablas routes/route_points/route_stops reales.
type PostgresRouteStore struct {
	Pool *pgxpool.Pool
}

// Upsert reemplaza la ruta completa (metadatos + puntos + paradas) del
// usuario indicado. El id ya existente ligado a otro usuario nunca se
// sobrescribe: la propia consulta de upsert falla en ese caso (Goal de
// aislamiento estricto, ver design.md).
func (s PostgresRouteStore) Upsert(ctx context.Context, userID int64, route Detail) error {
	if len(route.Points) > MaxPoints {
		return ErrTooManyPoints
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		INSERT INTO routes (id, user_id, created_at, duration, total_distance, avg_speed, status, name, notes, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
		ON CONFLICT (id) DO UPDATE SET
			duration = EXCLUDED.duration,
			total_distance = EXCLUDED.total_distance,
			avg_speed = EXCLUDED.avg_speed,
			status = EXCLUDED.status,
			name = EXCLUDED.name,
			notes = EXCLUDED.notes,
			updated_at = now()
		WHERE routes.user_id = $2`,
		route.ID, userID, route.CreatedAt, route.Duration, route.TotalDistance, route.AvgSpeed, route.Status, route.Name, route.Notes,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrRouteOwnedByAnotherUser
	}

	if _, err := tx.Exec(ctx, "DELETE FROM route_points WHERE route_id = $1", route.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "DELETE FROM route_stops WHERE route_id = $1", route.ID); err != nil {
		return err
	}

	if err := insertPoints(ctx, tx, route.ID, route.Points); err != nil {
		return err
	}
	if err := insertStops(ctx, tx, route.ID, route.Stops); err != nil {
		return err
	}

	return tx.Commit(ctx)
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
		"SELECT id, created_at, duration, total_distance, avg_speed, status, name, notes FROM routes WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	routeList := []Route{}
	for rows.Next() {
		var r Route
		if err := rows.Scan(&r.ID, &r.CreatedAt, &r.Duration, &r.TotalDistance, &r.AvgSpeed, &r.Status, &r.Name, &r.Notes); err != nil {
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
		"SELECT id, created_at, duration, total_distance, avg_speed, status, name, notes FROM routes WHERE id = $1 AND user_id = $2",
		id, userID,
	).Scan(&detail.ID, &detail.CreatedAt, &detail.Duration, &detail.TotalDistance, &detail.AvgSpeed, &detail.Status, &detail.Name, &detail.Notes)
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
		"SELECT timestamp, lat, lng, alt, speed FROM route_points WHERE route_id = $1 ORDER BY timestamp ASC",
		routeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []Point{}
	for rows.Next() {
		var p Point
		if err := rows.Scan(&p.Timestamp, &p.Lat, &p.Lng, &p.Alt, &p.Speed); err != nil {
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
