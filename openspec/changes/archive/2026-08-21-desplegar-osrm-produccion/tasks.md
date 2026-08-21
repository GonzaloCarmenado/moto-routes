## 1. `docker-compose.prod.yml`

- [x] 1.1 Añadir servicio `osrm` (imagen `ghcr.io/project-osrm/osrm-backend`, `network_mode: host`, comando `osrm-routed --algorithm mld /data/spain-latest.osrm`, volumen `./osrm/data:/data:ro`, healthcheck TCP igual que en `docker-compose.yml` dev), sin publicar el puerto 5000 fuera de loopback.
- [x] 1.2 Validar sintaxis con `docker compose -f infra/docker/docker-compose.prod.yml config` (sin `.env.prod` real disponible en local — usar un `.env.prod` de prueba con valores dummy, sin commitear).
- [x] 1.3 Verificación local: `docker compose -f infra/docker/docker-compose.prod.yml up -d osrm` con los datos reales ya presentes en `./osrm/data` (no vacíos como se planteó originalmente — Docker Desktop estaba parado al escribir la tarea y los datos de la sesión `normalizar-y-exportar-rutas` seguían ahí) — arranca, healthcheck en `healthy`, responde 200 a `/nearest` con match real cerca de Puerta del Sol, escucha en `127.0.0.1:5000` (confirmado en logs: `IP address: 127.0.0.1`). El caso "sin bloquear nada" es estructural: `api` no tiene `depends_on: osrm` en `docker-compose.prod.yml`, así que Compose nunca condiciona uno al otro.

## 2. Documentación

- [x] 2.1 Reescribir la sección "Pendiente: servidor de producción" de `infra/docker/osrm/README.md` como procedimiento: acceso SSH propio del usuario (no `ci-deploy`), comprobar `free -h` antes de lanzar, ejecutar `prepare-osm-data.sh` en el servidor, rellenar `MAPMATCH_OSRM_URL` en `.env.prod`, redeploy normal.
- [x] 2.2 Revisar `infra/docker/.env.prod.example` — confirmar que el comentario de `MAPMATCH_OSRM_URL` sigue siendo preciso ahora que el servicio `osrm` existe en `docker-compose.prod.yml` (antes decía "cuando el servicio esté desplegado"; ajustar si hace falta).

## 3. Cierre

- [x] 3.1 `openspec validate --strict` sin errores.
- [x] 3.2 Añadir ADR-053 a `memory/decisions.md` (servicio `osrm` en producción vía `network_mode: host`, procesado de datos deliberadamente fuera del pipeline automático — ver `design.md` Decisión 2).
- [x] 3.3 Actualizar `memory/context.md` (Estado Actual del Proyecto): resumen de sesión, y marcar como resuelto el pendiente "OSRM sin procesar en producción" de la sesión `skip-quality-gates-docs-only`.
