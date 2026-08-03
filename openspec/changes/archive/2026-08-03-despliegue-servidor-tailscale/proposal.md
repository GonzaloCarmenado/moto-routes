## Why

`entorno-api-docker` dejó `apps/api` funcionando en local vía Docker Compose, pero ningún despliegue real — el servidor de producción (Debian 13, alcanzable solo por Tailscale, sin IP pública) seguía sin tener nada corriendo. Este cambio da el primer paso real: llevar ese mismo servicio Java a ese servidor concreto, conectado a una base de datos que ya existe allí.

## What Changes

- Instalar Docker Engine + plugin `docker compose` en el servidor Debian 13 (no estaba instalado — verificado por SSH, contradice lo asumido inicialmente).
- Instalar Git en el servidor y clonar el repositorio para poder construir la imagen de `apps/api` directamente allí (mismo `Dockerfile` ya existente, sin cambios).
- Ejecutar `apps/api` en un contenedor con `network_mode: host`, para que se conecte al PostgreSQL 17 **nativo** que ya corre en el servidor (`appdb`/`appuser`, creados de antemano por el propio usuario para este despliegue) sin modificar su configuración (`pg_hba.conf`/`postgresql.conf` intactos, solo aceptan conexiones por loopback).
- Crear la tabla dummy `healthcheck` dentro de `appdb` (mismo SQL que `infra/docker/postgres/init.sql`, ejecutado a mano una vez porque aquí no hay mecanismo `docker-entrypoint-initdb.d`).
- Restringir a qué interfaz de red escucha la API: solo `tailscale0` (no la LAN doméstica ni, en teoría, ningún acceso público), acotando la exposición al mínimo imprescindible.
- Credenciales de `appuser` (contraseña ya regenerada en esta sesión) en un `.env` del propio servidor, no versionado — mismo patrón que `infra/docker/.env` de la spec local.
- **BREAKING**: ninguno — no se toca la app móvil ni el entorno de desarrollo local ya existente.

Fuera de alcance explícito (decidido con el usuario): pipeline de CI/CD que construya y despliegue automáticamente en cada release (queda para un cambio futuro), cualquier exposición pública real fuera de Tailscale/LAN, y cualquier cambio al PostgreSQL nativo más allá de crear la tabla dummy.

## Capabilities

### New Capabilities
- `server-deployment`: despliegue del servicio `apps/api` en el servidor de producción real (Debian 13, vía Tailscale), incluyendo su conexión al PostgreSQL nativo ya existente y la restricción de red de la API a la interfaz Tailscale.

### Modified Capabilities
(ninguna — `api-backend` y `local-dev-environment`, las capabilities ya cerradas de `entorno-api-docker`, no cambian ningún requisito: el comportamiento del endpoint `/api/ping` y del entorno de Docker Compose local siguen exactamente igual. Este cambio solo añade dónde y cómo se ejecuta ese mismo servicio en un entorno nuevo.)

## Impact

- **Servidor** (Debian 13, `[tailscale-ip-redactada]` vía Tailscale, usuario `[usuario-redactado]` con sudo): nuevo Docker Engine + `docker compose` plugin, Git, una copia clonada del repositorio, un contenedor `apps/api` en ejecución con `restart: unless-stopped`.
- **PostgreSQL nativo del servidor**: sin cambios de configuración; solo una tabla nueva (`healthcheck`) dentro de la base de datos `appdb` ya existente, y la contraseña de `appuser` ya regenerada (verificada, pendiente de guardar en el `.env` del servidor como parte de este cambio).
- **Repositorio**: probablemente un nuevo fichero de despliegue (`infra/docker/docker-compose.prod.yml` o similar, a decidir en `design.md`) y/o un script de despliegue documentado — sin tocar `apps/mobile/` ni las specs ya cerradas.
- **Dependencias nuevas**: ninguna de código; software de sistema nuevo en el servidor (Docker Engine, Git) fuera del repositorio.
