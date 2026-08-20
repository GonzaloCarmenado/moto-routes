## Context

Ver proposal.md - Why. `PostgresRouteStore.Upsert` (`apps/api/internal/routes/postgres_store.go`) ya llama a `s.normalizePoints(ctx, route.ID, route.Points)` de forma síncrona, después del `tx.Commit()`, antes de devolver el control al handler — el map-matching (best-effort) ya ha terminado (con éxito o no) en el momento en que `UpsertHandler` construye la respuesta. El problema no es de timing/async, es que ese resultado nunca sale de `normalizePoints` hacia el handler ni hacia el cliente.

En el frontend, `route-detail.element.ts` ya vuelve a llamar a `this.render()` completo (que reconstruye el mapa vía `buildMap(this._points)`) dentro del callback `onUploaded` — el mapa ya se repintaría solo con que `_points`/`_routePoints` llevaran los datos correctos en ese momento. El único hueco real es que `onUploaded` no recibe ni aplica esos datos.

## Goals / Non-Goals

**Goals:**
- La respuesta HTTP de `PUT /api/routes/{id}` incluye los puntos resultantes de la ruta (posición original o, si el `Matcher` la ajustó, la posición corregida).
- Tras una subida con éxito, `<route-detail>` actualiza `_points`/`_routePoints` con esos puntos antes de repintar, sin llamada adicional al servidor.

**Non-Goals:**
- No se cambia el algoritmo de normalización, su umbral de 30 m, ni el cliente OSRM (`internal/mapmatch`) — ya implementados y verificados en `normalizar-y-exportar-rutas`.
- No se toca `GPXExportHandler` ni el botón/menú de exportación — confirmado con el usuario que el gate `existsOnServer` es correcto tal cual.
- No se añade normalización a la descarga de una ruta exclusiva de la nube (`GetByIDForUser`/`DetailHandler`) — ya devuelve `matched_lat`/`matched_lng` desde la sesión anterior; este cambio solo toca la respuesta de subida (`Upsert`/`UpsertHandler`), que es la que hoy no los expone.
- **Limitación conocida, no corregida aquí**: `fetchCloudRouteDetail`/`cloudRouteDetailToLocal` (usados al abrir el detalle de una ruta exclusiva de la nube) tampoco parsean `matched_lat`/`matched_lng` de la respuesta del servidor — el mismo síntoma en otro punto de entrada. Fuera de alcance porque el usuario pidió específicamente el flujo de subida; queda para un cambio aparte si se decide cerrarlo también.
- No se persiste el ajuste en la base de datos local (`IRouteRepository`): los puntos normalizados solo se aplican en memoria (`_points`/`_routePoints`) tras la subida, para esa sesión de pantalla. Si el usuario sale y vuelve a entrar sin recargar desde el servidor, una ruta local sincronizada volverá a mostrar sus puntos crudos hasta la siguiente subida — igual que hoy. Ampliar `IRouteRepository` para persistir el ajuste localmente es un cambio de esquema SQLite mayor, no justificado solo para pintar el mapa tras subir.

## Decisions

**D1 — `normalizePoints` devuelve los puntos resultantes en vez de limitarse a persistirlos.**
Hoy `normalizePoints(ctx, routeID, points)` no devuelve nada: solo hace `UPDATE ... SET matched_lat, matched_lng` por cada punto ajustado y loggea si el `Matcher` falla. Pasa a devolver `[]Point` (los mismos `route.Points` de entrada, con `MatchedLat`/`MatchedLng` rellenos donde el `Matcher` los ajustó) para que `Upsert` pueda propagarlos. Alternativa descartada: volver a hacer un `SELECT` a `route_points` tras el `UPDATE` para releer lo persistido — innecesario, ya se tiene el dato en memoria durante el propio ajuste; un `SELECT` extra solo añade una consulta sin ganar nada (best-effort ante fallo del `Matcher` sigue igual: si el `Matcher` falla, se devuelven los puntos sin ningún `Matched*` relleno, igual que hoy quedan en la tabla).

**D2 — `Store.Upsert` cambia de `error` a `([]Point, error)`.**
Es el único cambio de firma necesario para que el handler tenga acceso a los puntos. Alternativa descartada: devolver el `Detail` completo — se descarta porque el handler ya tiene todo lo demás (metadatos, paradas) del propio `upsertRequest` que recibió; devolver solo los puntos evita reconstruir/duplicar datos que el cliente ya conoce.

**D3 — `upsertResponse` gana un campo `points`, mismo shape que la respuesta del detalle.**
Reutiliza el mismo JSON de punto que ya usa `DetailHandler` (`timestamp`/`lat`/`lng`/`alt`/`speed`/`matched_lat`/`matched_lng`), para que el frontend pueda reutilizar el mismo parseo/transform que ya tiene para el detalle de ruta (`route-detail-cloud.transform.ts`) en vez de escribir uno nuevo solo para la subida.

**D4 — `onUploaded` pasa de `() => void` a `(points: RoutePoint[]) => void`.**
`route-detail-cloud-upload.ts` reenvía los puntos que le devuelve `uploadRouteToCloud`. `route-detail.element.ts` asigna `_points`/`_routePoints` con esos puntos antes de `this.render()` — el propio `render()` ya reconstruye el mapa vía `buildMap(this._points)` (ver Context), así que no hace falta ningún método de repintado nuevo, solo que los datos estén actualizados antes de la llamada que ya existe.

## Risks / Trade-offs

- **[Riesgo] Cambiar la firma de `Store.Upsert`** rompe en compilación cualquier implementación del interfaz fuera de `PostgresRouteStore` (dobles de test) → ya contemplado en el Impact de proposal.md: los tests de `postgres_store_test.go`/`handler_test.go` que usan un doble se actualizan a la nueva firma como parte de este mismo cambio, no queda pendiente.
- **[Riesgo] Payload de subida más pesado** (la respuesta ahora lleva todos los puntos, no solo el id) → aceptado: incluso una ruta larga (~MaxPoints) es la misma cantidad de datos que ya se transfiere hoy en la petición de subida (los puntos ya viajaron del móvil al servidor en el propio `PUT`); no es tráfico nuevo, es tráfico que ya existía yendo también de vuelta.
