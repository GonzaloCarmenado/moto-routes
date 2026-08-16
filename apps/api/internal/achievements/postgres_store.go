package achievements

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresAchievementStore implementa Store contra las tablas achievements
// y user_achievements reales.
type PostgresAchievementStore struct {
	Pool *pgxpool.Pool
}

// aggregatesQuery calcula, en una sola consulta, los agregados de progreso
// de un usuario sobre sus rutas ya sincronizadas. safe_parse_timestamptz()
// (función de la migración 0009) aísla a nivel de fila cualquier
// routes.created_at no parseable — esa ruta simplemente no cuenta para
// month_km, el resto de agregados no se ve afectado (ver design.md Decisión 4).
const aggregatesQuery = `
	SELECT
		COALESCE(SUM(total_distance), 0),
		COUNT(*),
		COALESCE(MAX(duration), 0),
		COALESCE(SUM(total_distance) FILTER (
			WHERE safe_parse_timestamptz(created_at) >= date_trunc('month', now())
		), 0)
	FROM routes
	WHERE user_id = $1`

// Aggregates calcula los agregados de progreso del usuario sobre sus rutas
// ya sincronizadas. Una ruta local sin sincronizar nunca llega a esta tabla,
// así que no cuenta (ver spec "Ruta local sin sincronizar no cuenta").
func (s PostgresAchievementStore) Aggregates(ctx context.Context, userID int64) (Aggregates, error) {
	var agg Aggregates
	err := s.Pool.QueryRow(ctx, aggregatesQuery, userID).Scan(
		&agg.TotalDistanceKM, &agg.RouteCount, &agg.LongestRouteSeconds, &agg.MonthDistanceKM,
	)
	if err != nil {
		return Aggregates{}, err
	}
	return agg, nil
}

// CheckAndGrant evalúa los logros que el usuario todavía no tiene otorgados
// contra sus agregados actuales, y otorga (INSERT ... ON CONFLICT DO
// NOTHING) los que cumplen su umbral. El filtro NOT EXISTS ya evita
// reevaluar logros ya otorgados; el ON CONFLICT es la garantía de BBDD ante
// una llamada concurrente (ver design.md Decisión 2) — nunca se otorga dos
// veces el mismo logro al mismo usuario.
func (s PostgresAchievementStore) CheckAndGrant(ctx context.Context, userID int64) ([]Achievement, error) {
	agg, err := s.Aggregates(ctx, userID)
	if err != nil {
		return nil, err
	}

	candidates, err := s.pendingAchievements(ctx, userID)
	if err != nil {
		return nil, err
	}

	granted := make([]Achievement, 0)
	for _, a := range candidates {
		if currentValue(a.RequirementType, agg) < a.Threshold {
			continue
		}
		tag, err := s.Pool.Exec(ctx,
			`INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)
			 ON CONFLICT (user_id, achievement_id) DO NOTHING`,
			userID, a.ID,
		)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() > 0 {
			granted = append(granted, a)
		}
	}
	return granted, nil
}

func (s PostgresAchievementStore) pendingAchievements(ctx context.Context, userID int64) ([]Achievement, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT a.id, a.key, a.requirement_type, a.threshold, a.title, a.description, a.icon
		 FROM achievements a
		 WHERE NOT EXISTS (
			SELECT 1 FROM user_achievements ua
			WHERE ua.user_id = $1 AND ua.achievement_id = a.id
		 )`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pending := []Achievement{}
	for rows.Next() {
		var a Achievement
		if err := rows.Scan(&a.ID, &a.Key, &a.RequirementType, &a.Threshold, &a.Title, &a.Description, &a.Icon); err != nil {
			return nil, err
		}
		pending = append(pending, a)
	}
	return pending, rows.Err()
}

// ListWithProgress devuelve el catálogo completo con el estado del usuario
// para cada logro: la fecha de consecución si ya está otorgado, o el valor
// actual del agregado relevante si está pendiente.
func (s PostgresAchievementStore) ListWithProgress(ctx context.Context, userID int64) ([]Progress, error) {
	agg, err := s.Aggregates(ctx, userID)
	if err != nil {
		return nil, err
	}

	rows, err := s.Pool.Query(ctx,
		`SELECT a.id, a.key, a.requirement_type, a.threshold, a.title, a.description, a.icon, ua.achieved_at::text
		 FROM achievements a
		 LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
		 ORDER BY a.requirement_type, a.threshold`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	progress := []Progress{}
	for rows.Next() {
		var p Progress
		if err := rows.Scan(
			&p.Achievement.ID, &p.Achievement.Key, &p.Achievement.RequirementType, &p.Achievement.Threshold,
			&p.Achievement.Title, &p.Achievement.Description, &p.Achievement.Icon, &p.AchievedAt,
		); err != nil {
			return nil, err
		}
		p.Current = currentValue(p.Achievement.RequirementType, agg)
		progress = append(progress, p)
	}
	return progress, rows.Err()
}
