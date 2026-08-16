-- routes.created_at es TEXT libre sin validar (el cliente siempre envia ISO
-- 8601, pero la columna no lo garantiza). Esta funcion aisla el cast a
-- timestamptz para que una sola fila con un valor no parseable devuelva NULL
-- en vez de abortar toda la consulta de agregados de un usuario.
CREATE FUNCTION safe_parse_timestamptz(value TEXT) RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN value::timestamptz;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE achievements (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    requirement_type TEXT NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id BIGINT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- Catalogo inicial (ver proposal.md / design.md Decision 6 de sistema-logros).
-- icon = 'default' para las 10 filas: un unico placeholder generico hasta que
-- se decida personalizar por logro (fuera de alcance de este cambio).
INSERT INTO achievements (key, requirement_type, threshold, title, description, icon) VALUES
    ('total_km_100', 'total_distance_km', 100, '100 km recorridos', 'Has superado los 100 km acumulados en tus rutas.', 'default'),
    ('total_km_500', 'total_distance_km', 500, '500 km recorridos', 'Has superado los 500 km acumulados en tus rutas.', 'default'),
    ('total_km_1500', 'total_distance_km', 1500, '1500 km recorridos', 'Has superado los 1500 km acumulados en tus rutas.', 'default'),
    ('ruta_larga_60', 'single_route_duration_seconds', 3600, 'Ruta larga', 'Has completado una ruta de mas de 1 hora.', 'default'),
    ('mes_km_100', 'monthly_distance_km', 100, '100 km en un mes', 'Has recorrido 100 km en un mismo mes natural.', 'default'),
    ('mes_km_300', 'monthly_distance_km', 300, '300 km en un mes', 'Has recorrido 300 km en un mismo mes natural.', 'default'),
    ('mes_km_500', 'monthly_distance_km', 500, '500 km en un mes', 'Has recorrido 500 km en un mismo mes natural.', 'default'),
    ('rutas_5', 'route_count', 5, '5 rutas grabadas', 'Has grabado 5 rutas.', 'default'),
    ('rutas_25', 'route_count', 25, '25 rutas grabadas', 'Has grabado 25 rutas.', 'default'),
    ('rutas_100', 'route_count', 100, '100 rutas grabadas', 'Has grabado 100 rutas.', 'default');
