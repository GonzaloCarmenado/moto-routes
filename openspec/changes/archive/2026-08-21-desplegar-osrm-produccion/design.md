## Context

`normalizacion-gps` (ver [[ADR-051]]) ya está implementada y verificada en local: servicio `osrm` en `docker-compose.yml` (dev), cliente `internal/mapmatch`, columnas `matched_lat`/`matched_lng`. `docker-compose.prod.yml` solo tiene el servicio `api` — no hay `osrm` ahí. `MAPMATCH_OSRM_URL` está documentada en `.env.prod.example` pero vacía en el `.env.prod` real del servidor. `scripts/deploy-local.sh` (ver [[ADR-044]]) es la shell de login fija del usuario restringido `ci-deploy`: `git pull --ff-only` + `docker compose -f docker-compose.prod.yml up -d --build` + healthcheck — sin shell libre, sin poder ejecutar comandos ad-hoc.

El procesado de datos OSM (`prepare-osm-data.sh`) picó a ~11.4 GB de RAM en local sobre el extracto de España completo (ver `infra/docker/osrm/README.md`). No se conoce la RAM libre real del servidor de producción (que ya corre `api`, PostgreSQL nativo, y MinIO).

## Goals / Non-Goals

**Goals:**
- El servicio `osrm` arranca en producción igual que en dev cuando los datos existen en `./osrm/data`.
- `MAPMATCH_OSRM_URL=http://127.0.0.1:5000` funciona sin más cambios, una vez el usuario haya procesado los datos.
- El procedimiento manual para procesar los datos en el servidor queda documentado con precisión suficiente para ejecutarlo sin ambigüedad.
- `deploy-local.sh` no se ve afectado: sigue funcionando igual si `./osrm/data` está vacío (best-effort, mismo criterio que en dev).

**Non-Goals:**
- No se automatiza `prepare-osm-data.sh` dentro de `deploy-local.sh` ni de ningún otro paso del pipeline de CI/CD.
- No se ejecuta el procesado real en el servidor como parte de este cambio (sin acceso SSH en esta sesión).
- No se resuelve la actualización incremental de datos OSM (ya fuera de alcance en [[ADR-051]], sigue siéndolo).

## Decisions

**Decisión 1 — Servicio `osrm` en `docker-compose.prod.yml` con `network_mode: host`, replicando el patrón de `api`.** El servicio `api` de este fichero ya usa `network_mode: host` para alcanzar el PostgreSQL nativo del servidor por loopback (ver `docker-compose.prod.yml` actual). `osrm` necesita el mismo tratamiento por el motivo inverso: que `api` lo alcance en `127.0.0.1:5000` sin depender de una red de Compose que en modo host no existe. Sin publicar el puerto 5000 fuera de loopback (ningún `ports:` — el acceso es solo desde el propio host, igual que en dev donde tampoco se publica al exterior).

**Decisión 2 — El procesado de datos OSM queda fuera del pipeline automático, deliberadamente.** Alternativas consideradas:
- **(a) Automatizar dentro de `deploy-local.sh`** — descartada: `osrm-extract` es un proceso de ~11 GB de RAM sin límite conocido de seguridad en un servidor de producción que ya sirve tráfico real (`api`, Postgres, MinIO). `deploy-local.sh` corre en cada push a `master` vía CI — lanzar un proceso de ese tamaño en cada despliegue, sin control de cuándo ni con qué RAM libre, es un riesgo operacional real, no hipotético (ya causó un OOM en local con el límite por defecto de Docker Desktop). Además `ci-deploy` no tiene shell libre para depurar un fallo a medio camino (ver [[ADR-044]]).
- **(b) Ejecutarlo como un job aparte de GitHub Actions con SSH al servidor** — descartada por ahora: añadiría una superficie de automatización nueva (credenciales SSH en CI) para un proceso que se ejecuta, en la práctica, una vez cada varios meses (solo cuando el mapa de España cambia de forma relevante) — coste de mantenimiento desproporcionado al beneficio frente a un paso manual documentado.
- **(c) Paso manual, documentado con precisión, ejecutado por el usuario con su propio acceso SSH** — elegida. Es infrecuente, de alto riesgo de recursos, y ya existe el mismo patrón en local (`prepare-osm-data.sh`) — reutilizarlo en el servidor sin envolverlo en más automatización mantiene la superficie de riesgo mínima.

**Decisión 3 — El servicio `osrm` no bloquea el arranque de `api` si los datos no existen**, mismo criterio que en dev (ver comentario de `docker-compose.yml`: "si no existe, este servicio simplemente no arranca y `api` sigue funcionando igual"). `osrm-routed` sale con error si el fichero `.osrm` no existe en el volumen montado — Compose no reintenta arrancarlo en bucle porque `api` no lo declara como `depends_on`.

## Risks / Trade-offs

- **[Riesgo confirmado en esta sesión] El servidor real tiene solo 5.6 GiB de RAM total — muy por debajo de los ~11.4 GB que picó `osrm-extract` en local — y además aloja `intercom-signaling`, un servicio de otro proyecto sin relación con moto-routes.** Ejecutar el procesado ahí habría arriesgado un OOM sobre un servicio ajeno, no solo sobre `api`. → Mitigación real aplicada: en vez de procesar en el servidor, se copiaron por `scp` los ficheros ya procesados en local (~3.4 GB) — evita el pico de RAM del `osrm-extract` por completo. El README documenta ambas rutas (procesar en el servidor si tiene RAM suficiente, o copiar desde una máquina que ya los tenga procesados).
- **[Riesgo] El usuario ejecuta `prepare-osm-data.sh` en el servidor sin verificar antes la RAM libre real → OOM afectando a `api`/Postgres/MinIO en producción.** → Mitigación: el README nuevo indica explícitamente comprobar `free -h` antes de lanzarlo, y recomienda ejecutarlo en una ventana de bajo uso.
- **[Riesgo] `docker compose up -d --build` de `deploy-local.sh` intenta recrear `osrm` en cada despliegue aunque los datos no hayan cambiado.** → Mitigación: sin mitigación adicional necesaria — recrear el contenedor `osrm` (sin rebuild de imagen, es `image:` no `build:`) es barato y no toca el volumen de datos ya procesado.
- **[Trade-off] Activar `MAPMATCH_OSRM_URL` en producción es un paso manual separado del despliegue de código**, no atómico con el `git pull` de `deploy-local.sh`. Aceptado: coherente con que `.env.prod` en general ya es edición manual en el servidor (no versionado, no gestionado por el pipeline).

## Migration Plan

Plan original (1-4) vs. lo realmente ejecutado en esta sesión, con el paso 2 sustituido tras descubrir que el servidor no tiene RAM suficiente para el procesado (ver Risks):

1. ~~Mergear este cambio...~~ — **pendiente todavía**: el servicio `osrm` se probó en el servidor con una copia temporal de `docker-compose.prod.yml` (revertida después vía `git checkout --`), no a través de un merge real. El merge/PR sigue siendo necesario para que el despliegue automático (`deploy-local.sh`) recree oficialmente el servicio `osrm` la próxima vez que corra.
2. ~~El usuario ejecuta `prepare-osm-data.sh` en el servidor~~ — **sustituido**: el servidor solo tiene 5.6 GiB de RAM (frente a los ~11.4 GB de pico local) y aloja un servicio ajeno (`intercom-signaling`) — ejecutar el procesado ahí habría sido un riesgo real de OOM sobre un servicio de otro proyecto. En su lugar, los ficheros ya procesados en local se copiaron por `scp` (~3.4 GB, sin reprocesar). Ver Risks, entrada nueva.
3. **Hecho**: `MAPMATCH_OSRM_URL=http://127.0.0.1:5000` añadido a `.env.prod` del servidor (variable que no existía en ese fichero) y `api` recreado — confirmado sano.
4. Pendiente: el próximo despliegue real vía `deploy-local.sh` (tras mergear este cambio) recreará `osrm` desde el `docker-compose.prod.yml` de git, ahora coincidente con la config ya probada manualmente — sin downtime esperado, mismo contenedor con la misma definición.

**Rollback**: vaciar `MAPMATCH_OSRM_URL` en `.env.prod` y redeploy — vuelve al comportamiento best-effort ya cubierto por la spec (`normalizacion-gps`, escenario "servicio no disponible"). Quitar el servicio `osrm` de `docker-compose.prod.yml` no es necesario para el rollback funcional.
