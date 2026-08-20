## Why

`normalizar-y-exportar-rutas` (archivado, PR #136 aún sin mergear) ya ajusta los puntos GPS de una ruta a la carretera más probable al subirla a la nube (`PostgresRouteStore.Upsert`, síncrono, best-effort), pero la respuesta de la subida solo devuelve `{id}` — nunca los puntos resultantes. El detalle de ruta en el móvil (`route-detail.element.ts`) por tanto sigue mostrando en el mapa los puntos GPS crudos justo después de subir, aunque el servidor ya haya guardado una versión corregida.

Recargar la pantalla no lo arregla: una ruta local sincronizada sigue leyendo sus puntos de la base de datos local (`IRouteRepository`), que nunca guarda los valores ajustados — solo `GPXExportHandler`/`DetailHandler` en el servidor los exponen hoy. Sin este cambio, la única forma de ver el trazado normalizado en el móvil es exportarlo a GPX y abrirlo en otra app. El usuario lo detectó antes de mergear la PR y pidió cerrar ese hueco ahora, en la misma rama.

## What Changes

- La respuesta de `PUT /api/routes/{id}` (subida/sincronización) pasa a incluir los puntos resultantes de la ruta (con `matched_lat`/`matched_lng` cuando el map-matching los ajustó), no solo el `id`.
- El detalle de ruta en el móvil usa esos puntos devueltos para repintar el mapa inmediatamente tras una subida con éxito, sin esperar a una recarga de la pantalla.
- Sin cambios en la lógica de normalización en sí (umbral de 30 m, cliente OSRM, best-effort ante fallo) ni en el botón/flujo de exportación GPX — quedan fuera de alcance, confirmado con el usuario.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `normalizacion-gps`: el escenario "Ruta con puntos GPS ruidosos se normaliza al guardarse" cambia — la respuesta de sincronización deja de ser "la misma que sin normalización"; ahora incluye los puntos resultantes cuando alguno se ajustó.
- `route-cloud-sync`: el escenario "Subida correcta" se amplía — además de pasar a sincronizada, el mapa del detalle debe reflejar de inmediato los puntos que el servidor haya devuelto (normalizados o, si no hubo ajuste, los mismos originales).

## Impact

- **Backend (`apps/api`)**:
  - `internal/routes/postgres_store.go`: `PostgresRouteStore.Upsert` deja de devolver solo `error` — devuelve también los puntos resultantes (originales + `matched_lat`/`matched_lng` si el `Matcher` los tocó). `normalizePoints` deja de ser fire-and-forget puro respecto al llamador: sigue siendo best-effort ante fallo del `Matcher`, pero su resultado (qué puntos cambiaron) debe llegar de vuelta al handler.
  - `internal/routes/handler.go`: `UpsertHandler`/`upsertResponse` incluyen los puntos en la respuesta JSON.
  - Interfaz `Store` (`internal/routes/store.go` o donde esté declarada) cambia de firma en el método `Upsert`.
  - Tests existentes de `postgres_store_test.go` y `handler_test.go` que llaman a `Upsert`/al endpoint de subida se actualizan a la nueva firma/forma de respuesta.
- **Frontend (`apps/mobile`)**:
  - `src/routes/detail/route-detail-cloud.service.ts` (`uploadRouteToCloud`): parsea y devuelve los puntos de la respuesta.
  - `src/routes/detail/route-detail-cloud-upload.ts`: `onUploaded` pasa a recibir esos puntos en vez de ser una función sin argumentos.
  - `src/routes/detail/route-detail.element.ts`: el callback `onUploaded` en `buildHeader()` actualiza `_points`/`_routePoints` con los puntos recibidos y repinta el mapa (`buildMap`), no solo la cabecera — hoy solo hace `_isSynced = true; this.render()` sin tocar esos campos.
  - Tests unitarios de los tres ficheros anteriores (`route-detail-cloud.service.spec.ts`, `route-detail-cloud-upload.spec.ts`, `route-detail.element.spec.ts`) se actualizan.
