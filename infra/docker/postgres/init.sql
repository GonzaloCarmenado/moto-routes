-- Tabla dummy para verificar conectividad end-to-end (API <-> Postgres) sin
-- acoplarse todavía a ningún modelo de dominio real de Moto Routes.
-- Se ejecuta una única vez, en el primer arranque del volumen de datos
-- (mecanismo nativo de la imagen oficial de postgres vía
-- /docker-entrypoint-initdb.d/).
CREATE TABLE IF NOT EXISTS healthcheck (
    id SERIAL PRIMARY KEY,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
