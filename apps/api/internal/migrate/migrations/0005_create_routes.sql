CREATE TABLE routes (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    total_distance DOUBLE PRECISION NOT NULL,
    avg_speed DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    name TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routes_user_id ON routes(user_id);

CREATE TABLE route_points (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX idx_route_points_route_id ON route_points(route_id);

CREATE TABLE route_stops (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    type TEXT NOT NULL,
    stop_category_id BIGINT REFERENCES stop_types(id)
);

CREATE INDEX idx_route_stops_route_id ON route_stops(route_id);
