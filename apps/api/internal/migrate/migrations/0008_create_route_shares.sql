CREATE TABLE route_shares (
    id UUID PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    from_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_route_shares_to_user_id ON route_shares(to_user_id, status);
CREATE INDEX idx_route_shares_from_user_id ON route_shares(from_user_id);
