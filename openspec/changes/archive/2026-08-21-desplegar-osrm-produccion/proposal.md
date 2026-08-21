## Why

`openspec/changes/normalizar-y-exportar-rutas` (ver ADR-051) implementó la normalización de puntos GPS vía OSRM y la desplegó — pero solo en local. `infra/docker/docker-compose.prod.yml` no define servicio `osrm`, y `MAPMATCH_OSRM_URL` está vacío en el `.env.prod` real del servidor. La spec `normalizacion-gps` ya contempla este estado como "servicio no disponible" (best-effort, sin romper nada), así que no hay incidente — pero ninguna ruta subida en producción se está normalizando hoy, y la feature lleva desde 2026-08-19 desplegada e inactiva.

## What Changes

- Añadir servicio `osrm` a `infra/docker/docker-compose.prod.yml`, con `network_mode: host` (mismo patrón que `MINIO_ENDPOINT` en ese fichero) para que `MAPMATCH_OSRM_URL=http://127.0.0.1:5000` funcione tal y como ya documenta `infra/docker/.env.prod.example`.
- El servicio arranca solo si los datos ya existen en `./osrm/data` (mismo comportamiento best-effort que en dev — sin bloquear ni frenar `api` si faltan).
- Reescribir la sección "Pendiente: servidor de producción" de `infra/docker/osrm/README.md` con el procedimiento manual exacto para procesar el extracto OSM en el servidor real (mismo script `prepare-osm-data.sh`, ejecutado ahí con el propio usuario SSH del usuario, no con `ci-deploy`).
- **Fuera de alcance, explícito**: no se automatiza el procesado de datos (`osrm-extract`/`partition`/`customize`, picos de ~11 GB de RAM) dentro de `scripts/deploy-local.sh` — ese script corre en cada despliegue vía el usuario restringido `ci-deploy` (shell fija, sin acceso libre, ver ADR-044), y meter ahí un proceso de ese tamaño en un servidor que ya corre `api`/Postgres/MinIO reales es un riesgo que no se quiere asumir sin más contexto de la RAM disponible del servidor. Ese paso queda manual, fuera del pipeline.
- **Actualización, misma sesión**: el planteamiento inicial de este proposal asumía no ejecutar el procesado real en el servidor (sin acceso SSH). El usuario autorizó el acceso SSH a mitad de sesión (Tailscale ACL + Tailscale SSH, aprobado desde el panel web) y hasta el final la ejecución real en el servidor. Ver "Impact" para el detalle de lo ejecutado.

## Capabilities

Sin capabilities nuevas ni modificadas: la spec `normalizacion-gps` ya cubre el comportamiento "servicio no disponible" como best-effort (ver escenario correspondiente) — activar `MAPMATCH_OSRM_URL` en producción no cambia ningún requisito observable, solo lo activa. Cambio puramente de infraestructura de despliegue y documentación (`skip_specs: true`).

## Impact

- `infra/docker/docker-compose.prod.yml`: nuevo servicio `osrm`.
- `infra/docker/osrm/README.md`: sección "Pendiente: servidor de producción" reescrita como procedimiento.
- `infra/docker/.env.prod.example`: sin cambios de contenido (ya documenta `MAPMATCH_OSRM_URL`); posible aclaración de que ahora requiere el servicio `osrm` desplegado.
- `scripts/deploy-local.sh`: sin cambios de código — verificar que sigue funcionando igual con el servicio `osrm` nuevo presente pero sin datos (best-effort).
- No afecta a `apps/api` ni `apps/mobile`: el cliente OSRM (`internal/mapmatch`) y el flujo de normalización ya existen y no cambian.
- **Servidor de producción, ejecutado en esta sesión**: descubierto que el servidor solo tiene 5.6 GiB de RAM total (muy por debajo de los ~11.4 GB que picó `osrm-extract` en local) y que aloja además un servicio de otro proyecto ajeno (`intercom-signaling`) — correr el procesado ahí habría sido un riesgo real de OOM sobre servicios que no son de este proyecto. En su lugar: los ficheros ya procesados en local (`spain-latest.osrm.*`, ~3.4 GB) se copiaron por `scp` a `infra/docker/osrm/data/` del servidor (directorio nuevo, creado con `sudo` por el propio usuario dado que `osrm/` pertenece a `ci-deploy` sin permiso de escritura para `gonzalo`). Verificado con el servicio real corriendo ahí (`healthy`, `/nearest` responde 200). `MAPMATCH_OSRM_URL=http://127.0.0.1:5000` añadido al `.env.prod` real (variable que no existía en ese fichero — predata la feature) y `api` recreado; confirmado sano vía `/api/ping` (200). La normalización está activa en producción desde ahora.
