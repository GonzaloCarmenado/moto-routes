## Context

`apps/api/internal/routes` ya persiste rutas completas (`UpsertHandler` → `PostgresRouteStore.Upsert`, ver [[ADR-040]]): hasta `MaxPoints = 50000` puntos por ruta, insertados en bloques de 500 filas. Los puntos llegan tal cual los graba el móvil (`route_points`: `lat`, `lng`, `alt`, `speed`, `timestamp`), sin ningún paso de limpieza. Ver proposal.md para el problema concreto que esto causa.

No existe hoy ninguna llamada saliente desde `apps/api` a un servicio HTTP de terceros para procesar datos de ruta — sí existe el patrón de llamar a un servicio externo público sin SDK (Resend en `confirmacion-email-usuarios`, ver [[ADR-038]]), que sirve de precedente para "cliente HTTP propio con `net/http`, sin librería nueva" en vez de un SDK.

## Goals / Non-Goals

**Goals:**
- Corregir los puntos GPS de una ruta pegándolos a la carretera real, de forma automática y transparente para el usuario.
- No perder nunca el dato crudo original.
- Exportar una ruta a GPX 1.1 estándar, usando el mejor dato disponible (normalizado o crudo).

**Non-Goals:**
- Reprocesar retroactivamente rutas ya sincronizadas antes de este cambio (quedan con puntos crudos hasta que el usuario vuelva a sincronizarlas; si hiciera falta, sería un script puntual, no una feature).
- Exportar a otros formatos (KML, JSON propio) — fuera de alcance de este cambio, mencionados solo como contexto en proposal.md.
- Perfil de enrutamiento específico para moto (curvas, carreteras de montaña) — se usa el perfil `car` por defecto de OSRM (ver Decisión 3).
- Normalización en tiempo real mientras se graba (solo se normaliza al sincronizar la ruta completa).

## Decisions

### 1. OSRM self-hosted como motor de map-matching — [[ADR-051]]
Decisión con alternativas reales evaluadas (GraphHopper Map Matching) y coste de reversión alto (infra + formato de datos propio) → merece ADR, registrada en `memory/decisions.md`. Resumen: OSRM, servicio `match` vía HTTP interno (`osrm-backend`, imagen oficial `ghcr.io/project-osrm/osrm-backend`), extracto OSM de España (Geofabrik) preprocesado una vez (`osrm-extract` + `osrm-partition` + `osrm-customize`) y montado como volumen de solo lectura. El contenedor **no se expone a internet ni al host** — solo alcanzable por `apps/api` dentro de la red interna de `docker-compose.yml`, igual que `postgres` hoy.

### 2. Cliente HTTP propio en `internal/mapmatch`, sin SDK
OSRM no tiene SDK oficial en Go. Se llama a `GET /match/v1/{profile}/{coordinates}` con `net/http` de la librería estándar (mismo patrón que el cliente de Resend, [[ADR-038]]) — cumple la política de dependencias mínimas sin justificar un paquete nuevo para una API HTTP simple.

### 3. Perfil `car`, no un perfil de moto propio
OSRM no trae un perfil de motocicleta de fábrica; construir uno (script Lua propio) es un proyecto en sí mismo y las carreteras que usa una moto de carretera coinciden con las que usa un coche a efectos de map-matching (el objetivo es "pegar a la vía", no calcular rutas óptimas para moto). Se usa el perfil `car` incluido en la imagen oficial de OSRM. Revisitable si en el futuro se necesita evitar autopistas/restricciones específicas de moto — no es el caso de este cambio (solo corregimos posición, no recalculamos itinerarios).

### 4. Troceado de puntos en bloques para el `/match`
El servicio `match` de OSRM tiene un límite de coordenadas por petición (configurable, por defecto 100). Con rutas de hasta 50 000 puntos ([[ADR-040]]), `internal/mapmatch` trocea la ruta en bloques de 100 puntos con solape de 1 punto entre bloques consecutivos (para que el algoritmo tenga contexto de continuidad en el borde), y concatena los resultados descartando el punto de solape duplicado. Alternativa descartada: subsamplear la ruta antes de enviarla (perdería precisión en tramos con curvas cerradas, justo donde más falta hace corregir el GPS).

### 5. Persistencia: columnas nuevas en `route_points`, no tabla aparte
Nueva migración (`0011_add_route_points_matched.sql`) añade `matched_lat DOUBLE PRECISION NULL` y `matched_lng DOUBLE PRECISION NULL` a `route_points`, en vez de una tabla `route_points_matched` separada. Mantiene la relación 1:1 punto-original ↔ punto-ajustado sin necesitar un JOIN ni gestionar reconciliación si el número de puntos ajustados no coincidiera con el original (con el troceado de la Decisión 4, siempre coincide 1:1). `NULL` en ambas columnas es la señal explícita de "no normalizado todavía" (fallback de la Decisión 6 y de `exportacion-gpx`).

### 6. Normalización síncrona y best-effort dentro del propio `UpsertHandler`
Decidido explícitamente con el usuario: la llamada a OSRM ocurre en el mismo request que guarda la ruta, no en un job aparte (evita infraestructura de colas nueva). Si OSRM no responde o falla, el upsert **no falla** — se guarda la ruta con `matched_lat`/`matched_lng` a `NULL` en los puntos afectados, exactamente igual que el patrón best-effort ya usado en `device-token.service.ts` para el registro de push.

### 7. Descarte de un punto ajustado que se aleja demasiado del original
Cada punto del resultado de `/match` trae una confianza y una posición ajustada. Si la distancia entre el punto ajustado y el original supera **30 metros** (holgado frente al margen de error típico de GPS urbano, ~10-15 m, pero corto para no aceptar un "salto" a una carretera equivocada), se descarta el ajuste para ese punto concreto y se deja `matched_lat`/`matched_lng` a `NULL` solo para él — el resto de la ruta se normaliza con normalidad. El valor es una constante en `internal/mapmatch`, no una variable de entorno (mismo criterio que `MaxPoints` en [[ADR-040]]: cambiarlo es una línea, no una decisión de despliegue).

### 8. Generación de GPX con `encoding/xml` de la librería estándar
GPX es XML plano; no hace falta ninguna librería de terceros para generarlo (cumple dependencias mínimas). Un nuevo `GPXExportHandler` en `internal/routes/` arma el documento GPX (`<trk>` con los puntos — ajustados si existen, crudos si no — y `<wpt>` por cada parada) y lo sirve con `Content-Type: application/gpx+xml`.

### 9. Sin secretos nuevos
OSRM corre en la red interna de Docker sin autenticación (no expone datos de usuario, solo sirve el grafo de carreteras público de OSM) — no hay ninguna credencial ni API key que gestionar para este cambio.

## Risks / Trade-offs

- **[Riesgo] Latencia añadida al `UpsertHandler`** por la llamada síncrona a OSRM (Decisión 6), especialmente en rutas largas con varios bloques de 100 puntos (Decisión 4) → Mitigación: timeout corto por bloque (a definir en implementación, del orden de segundos) y best-effort — un timeout se trata igual que un fallo de OSRM, no bloquea el guardado.
- **[Riesgo] Cobertura del extracto OSM limitada a España** → si una ruta cruza a otro país (frontera con Francia/Portugal, poco común pero posible), los puntos fuera de cobertura simplemente no se normalizan (caen al mismo camino que "OSRM no disponible"). Aceptado como limitación conocida, no bloqueante.
- **[Riesgo] Datos OSM desactualizados** (carreteras nuevas o cambiadas desde el extracto) → mitigación operativa, no de código: procedimiento documentado de regenerar el extracto y reconstruir `osrm-extract`/`partition`/`customize`, sin automatizarlo en este cambio.
- **[Impacto en `src/shared/`]**: `route-cloud-api.service.ts` gana una función nueva de exportación — lo consumen tanto `routes/detail` como, potencialmente, `routes/list` en el futuro; añadirla como función independiente (no modificar las existentes) evita romper los flujos de sincronización ya probados.

## Migration Plan

1. Generar el extracto OSM de España (Geofabrik) y preprocesarlo (`osrm-extract` + `osrm-partition` + `osrm-customize`) — procedimiento documentado, ejecutado una vez fuera del build (no en CI, por tamaño y tiempo).
2. Añadir el servicio `osrm` a `infra/docker/docker-compose.yml` (y a `docker-compose.prod.yml` si aplica), sin puerto publicado al host.
3. Migración `0011_add_route_points_matched.sql`.
4. Implementar `internal/mapmatch` (cliente + troceado + descarte por distancia) y su wiring en `UpsertHandler`/`PostgresRouteStore`.
5. Implementar `GPXExportHandler` + ruta en el router.
6. Frontend: función de exportación en `route-cloud-api.service.ts` + acción en `routes/detail`.

**Rollback**: quitar el servicio `osrm` de `docker-compose.yml` y dejar de invocarlo (el código ya trata su ausencia como "no disponible", best-effort — no requiere revertir la migración). Si hiciera falta revertir del todo, `matched_lat`/`matched_lng` son columnas nullable sin ninguna otra tabla dependiente — un `DROP COLUMN` no toca los puntos originales.
