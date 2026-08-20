# 09 · Entornos: local y producción

## Entorno local (desarrollo)

Orquestado por **Docker Compose** en `infra/docker/docker-compose.yml`. Servicios:

| Servicio | Imagen | Rol | Puertos |
|----------|--------|-----|---------|
| `postgres` | `postgres:16-trixie` | Base de datos de la API | 5432 |
| `minio` | `minio/minio` | Almacenamiento S3 de fotos | 9000 (API), 9001 (consola) |
| `minio-init` | `minio/mc` | Crea el bucket una vez y termina | — |
| `osrm` | `ghcr.io/project-osrm/osrm-backend` | Normalización GPS (map matching), best-effort | (interno) |
| `api` | build `apps/api/Dockerfile` | La API Go | 8080 |

> `osrm` requiere el extracto OSM de España ya procesado en `infra/docker/osrm/data/` (varios GB, no
> versionado; se regenera con `infra/docker/osrm/prepare-osm-data.sh`). Si no existe, ese servicio no
> arranca y la API funciona igual (la normalización queda desactivada).

### Variables de entorno (local)

Definidas en `infra/docker/.env.example` (copiar a `.env`, **no versionado**). Nombres:

- Base de datos: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (valores triviales de desarrollo).
- API: `DATABASE_URL`, `AUTH_TOKEN_SECRET`, `PUBLIC_API_BASE_URL`, `SERVER_ADDRESS`.
- Email: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`.
- Fotos: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`,
  `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `PHOTO_ENCRYPTION_KEY` (AES-256, 32 bytes base64; generar con
  `openssl rand -base64 32`).
- Push: `FCM_SERVICE_ACCOUNT_JSON` (opcional).
- Normalización: `MAPMATCH_OSRM_URL` (opcional).

Para el frontend: `apps/mobile/.env.example` → `VITE_API_BASE_URL=http://localhost:8080`.

> Los valores reales **nunca** van en ficheros versionados. `.env` está en `.gitignore`.

## Entorno de producción

### Servidor

- **Debian** (servidor doméstico), con `apps/api` desplegada en **Docker** usando
  `infra/docker/docker-compose.prod.yml` y `env_file: .env.prod`.
- **PostgreSQL nativo del servidor** (no contenedor), escuchando solo en `127.0.0.1/::1`. El
  contenedor usa `network_mode: host` para que ese loopback sea el mismo dentro y fuera (sin tocar
  `pg_hba.conf`/`postgresql.conf`).
- **MinIO nativo** (S3), con credenciales dedicadas para `apps/api` acotadas a un único bucket
  (nunca las credenciales root).
- `apps/api` escucha **solo en la IP Tailscale** del servidor (`SERVER_ADDRESS`), no en loopback.

### Variables de entorno (producción)

Definidas en `infra/docker/.env.prod.example` (copiar a `.env.prod`, **no versionado**). Nombres:

`DATABASE_URL`, `AUTH_TOKEN_SECRET`, `SERVER_ADDRESS` (IP Tailscale), `RESEND_API_KEY`,
`RESEND_FROM_ADDRESS`, `PUBLIC_API_BASE_URL` (URL pública HTTPS de Funnel), `MINIO_ENDPOINT`,
`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `PHOTO_ENCRYPTION_KEY`,
`FCM_SERVICE_ACCOUNT_JSON`, `MAPMATCH_OSRM_URL`.

### Exposición pública

- **Tailscale Funnel** expone la API con URL pública HTTPS (`…ts.net`), usada para enlaces de
  verificación/reset de email abribles fuera del tailnet.

### Despliegue

Tres vías (ver 10):

1. **`scripts/deploy-prod.sh`** — desde la máquina de desarrollo, por SSH a Tailscale: `git pull
   --ff-only` → `docker compose up -d --build` → health check.
2. **`scripts/deploy-local.sh`** — se ejecuta **dentro** del servidor, como shell de login del
   usuario restringido `ci-deploy` (solo ejecuta ese script, nunca una shell libre).
3. **GitHub Actions** (`deploy-prod` job) — automatizado al publicar un tag `v*`.

### Health check

`GET /api/ping` (responde 200 con estado de Postgres). `deploy-local.sh` lo comprueba contra la IP
Tailscale del servidor (resuelta en runtime), `deploy-prod.sh` contra la URL pública.

## Tabla comparativa

| Aspecto | Local | Producción |
|---------|-------|------------|
| API | Contenedor Docker (Compose) | Contenedor Docker (`network_mode: host`) |
| PostgreSQL | Contenedor `postgres:16-trixie` | Nativo en el servidor (loopback) |
| MinIO | Contenedor + `minio-init` | Nativo (loopback) |
| OSRM | Contenedor (opcional) | Servicio en servidor (opcional) |
| Red | `localhost:8080` | Solo IP Tailscale (+ Funnel público) |
| Secretos | `infra/docker/.env` (no versionado) | `infra/docker/.env.prod` (no versionado) |
| Despliegue | `docker compose up` | `deploy-prod.sh` / `deploy-local.sh` / Actions |
