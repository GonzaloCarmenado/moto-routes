CREATE TABLE stop_types (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    icon TEXT NOT NULL
);

INSERT INTO stop_types (key, label, icon) VALUES
    ('bar-restaurante', 'Bar / restaurante', '🍽️'),
    ('mirador', 'Mirador', '🏔️'),
    ('monumento', 'Monumento', '🏛️'),
    ('gasolinera', 'Gasolinera', '⛽'),
    ('alojamiento', 'Alojamiento', '🛏️'),
    ('taller-mecanico', 'Taller / mecánico', '🔧'),
    ('aparcamiento', 'Aparcamiento', '🅿️'),
    ('otro', 'Otro', '📍');
