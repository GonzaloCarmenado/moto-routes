## Why

La auditoría de seguridad del servidor de producción (2026-08-07, `docs/informe-tecnico-seguridad.md`) encontró tres problemas: (1) el contenedor de `apps/api` corre como `root`, superficie innecesaria en un servicio expuesto públicamente vía Tailscale Funnel; (2) el servicio **MinIO** corre en el servidor sin ningún ADR que lo documente (provisión anticipada para blob storage, sin código que lo use todavía); (3) el servidor **no se había redesplegado** tras el merge de `rutas-en-la-nube` — `/api/routes` devolvía `404` y faltaba la migración `0005`. Los puntos (1) y (3) son el patrón ya vivido en ADR-036: un despliegue manual que se olvida rompe producción en silencio, y un contenedor como root es un riesgo evitable.

## What Changes

- **`apps/api/Dockerfile`** — la etapa runtime pasa a ejecutar `apps/api` como **usuario no-root** (`appuser`) con permisos mínimos, manteniendo la paridad operativa (`debian:trixie-slim`, `network_mode: host`).
- **Nuevo script versionado `scripts/deploy-prod.sh`** — automatiza el despliegue manual en el servidor de producción vía SSH por Tailscale: `git pull`, `docker compose -f docker-compose.prod.yml up -d --build` y verificación de `/api/ping`. Sustituye al paso manual documentado en ADR-033/036 sin contradecir la decisión de no automatizar por webhook (ADR-029/030).
- **Nuevo ADR-041 en `memory/decisions.md`** — documenta MinIO: qué es, por qué está en el servidor, que no tiene código consumidor todavía, y la condición para revisarlo.
- **Redespliegue real del servidor** como parte de la verificación de este cambio — activa la migración `0005` y el endpoint `/api/routes`.
- Sin cambios de comportamiento en el frontend ni en la API de negocio.

## Capabilities

### New Capabilities

_(Ninguna — los cambios caen dentro de la capability existente `server-deployment`; el ADR de MinIO es documentación pura.)_

### Modified Capabilities

- `server-deployment`: se añaden dos requisitos de comportamiento al despliegue — (1) el contenedor de `apps/api` SHALL ejecutarse como usuario no-root; (2) el despliegue en el servidor SHALL poder realizarse con un script versionado (no solo pasos manuales recordados), y el script SHALL verificar la salud del servicio tras desplegar.

## Impact

- **`apps/api/Dockerfile`** — etapa runtime (`USER appuser`, `WORKDIR`, permisos del binario y de `/tmp` si aplica).
- **`scripts/deploy-prod.sh`** (nuevo) — script Bash con la secuencia SSH+deploy+verify; documenta en comentarios el patrón de ADR-033/036.
- **`memory/decisions.md`** — ADR-041 nuevo (MinIO).
- **`infra/docker/docker-compose.prod.yml`** — se revisa pero no se espera cambio (usuario lo define el Dockerfile, `network_mode: host` y `env_file` se mantienen).
- **Servidor de producción (Debian vía Tailscale)** — redespliegue real: imagen no-root + migración `0005` aplicada + `/api/routes` verificado.
- **Sin impacto** en `apps/mobile`, en la API de negocio (handlers/store auth/routes) ni en CI (`ci-cd` no se toca).