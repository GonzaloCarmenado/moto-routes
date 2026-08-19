## 1. Infraestructura OSRM

- [x] 1.1 Descargar el extracto OSM de España (Geofabrik) y documentar el procedimiento (script o README) para regenerarlo en el futuro.
- [x] 1.2 Ejecutar `osrm-extract` + `osrm-partition` + `osrm-customize` sobre el extracto y dejar los ficheros `.osrm` resultantes listos para montar como volumen.
- [x] 1.3 Añadir el servicio `osrm` a `infra/docker/docker-compose.yml` (imagen oficial `osrm-backend`, perfil `car`, sin puerto publicado al host, solo red interna).
- [x] 1.4 Levantar el stack local (`docker compose up`) y verificar con una llamada manual (`curl`) al endpoint `/match` desde el contenedor `api` que el servicio responde.

## 2. Persistencia — columnas de puntos normalizados

- [x] 2.1 Migración `0011_add_route_points_matched.sql`: añadir `matched_lat DOUBLE PRECISION NULL` y `matched_lng DOUBLE PRECISION NULL` a `route_points`.
- [x] 2.2 Test de integración (`internal/dbtest`) que confirma que la migración aplica limpia sobre el esquema existente y que ambas columnas aceptan `NULL`.

## 3. Cliente OSRM (`internal/mapmatch`)

- [x] 3.1 Test: dado un conjunto de puntos GPS que cabe en un solo bloque (≤100), el cliente llama a `/match/v1/car/...` y devuelve las coordenadas ajustadas en el mismo orden.
- [x] 3.2 Implementación mínima del cliente HTTP (`net/http`, sin SDK) que cumple 3.1.
- [x] 3.3 Test: con más de 100 puntos, el cliente trocea en bloques de 100 con solape de 1 punto y devuelve el resultado concatenado sin duplicar el punto de solape.
- [x] 3.4 Implementación del troceado que cumple 3.3.
- [x] 3.5 Test: si el punto ajustado devuelto por OSRM se aleja más de 30 metros del punto original, el cliente descarta el ajuste para ese punto concreto (devuelve `nil`/sin ajuste solo para él).
- [x] 3.6 Implementación del descarte por distancia que cumple 3.5.
- [x] 3.7 Test: si OSRM no responde, responde con error HTTP, o se agota el timeout, el cliente devuelve un error explícito sin hacer panic ni bloquear indefinidamente.
- [x] 3.8 Implementación del manejo de fallos/timeout que cumple 3.7.

## 4. Normalización en el upsert de rutas

- [x] 4.1 Test (`postgres_store_test.go`): al hacer upsert de una ruta con puntos, si el cliente de map-matching devuelve resultado, `route_points.matched_lat`/`matched_lng` quedan rellenos en la fila correspondiente.
- [x] 4.2 Test: si el cliente de map-matching falla (mock que devuelve error), el upsert de la ruta se completa igualmente (200/sin error) y `matched_lat`/`matched_lng` quedan `NULL`.
- [x] 4.3 Implementación: `PostgresRouteStore.Upsert` invoca `internal/mapmatch` tras insertar los puntos crudos, best-effort, y actualiza las columnas nuevas — cumple 4.1 y 4.2.
- [x] 4.4 Test: las paradas (`route_stops`) de una ruta no se ven alteradas por el proceso de normalización.

## 5. Exportación GPX

- [x] 5.1 Test (`handler_test.go`): exportar una ruta con puntos normalizados genera un GPX cuyo `<trk>` usa `matched_lat`/`matched_lng`.
- [x] 5.2 Test: exportar una ruta sin normalizar (columnas `NULL`) genera un GPX cuyo `<trk>` usa los puntos crudos.
- [x] 5.3 Test: exportar una ruta ajena o inexistente responde 404 en ambos casos, sin distinguir cuál.
- [x] 5.4 Test: exportar una ruta sin puntos GPS responde con un error explícito (no un GPX vacío).
- [x] 5.5 Test: el GPX generado incluye cada parada de la ruta como `<wpt>` independiente.
- [x] 5.6 Test: el GPX generado es un documento GPX 1.1 bien formado (validable contra el esquema).
- [x] 5.7 Implementación de `GPXExportHandler` (`encoding/xml`) que cumple 5.1–5.6, registrado en el router con la misma autenticación/autorización que `DetailHandler`.

## 6. Frontend — exportación desde el detalle de ruta

- [x] 6.1 Test (`route-cloud-api.service.spec.ts`): nueva función de exportación llama al endpoint GPX y devuelve el fichero/blob.
- [x] 6.2 Test: la función propaga un error explícito si la petición falla (red o servidor).
- [x] 6.3 Implementación de la función de exportación en `route-cloud-api.service.ts` que cumple 6.1–6.2.
- [x] 6.4 Nueva acción "Exportar GPX" en `routes/detail` (siguiendo el patrón de extracción del dominio, ej. `route-detail-export.ts`), con su `data-cy` correspondiente.
- [x] 6.5 Test: al pulsar la acción, se invoca la exportación y se ofrece compartir/guardar el fichero con el selector nativo.
- [x] 6.6 Test: si la exportación falla, se muestra un toast de error (`shared/feedback/toast.ts`) y no queda la pantalla en estado de carga indefinido.
- [x] 6.7 Cypress E2E: exportar una ruta desde el detalle y confirmar que se dispara la descarga/compartición.

## 7. Verificación en dispositivo real

- [x] 7.1 Sincronizar desde el dispositivo Android real una ruta con puntos GPS ruidosos conocidos (zona con mala cobertura) y confirmar en la base de datos del servidor que `matched_lat`/`matched_lng` corrigen la desviación. (ruta real sincronizada desde el dispositivo; 3/15 puntos normalizados — el resto era jitter GPS estático sin movimiento direccional, correctamente sin forzar un ajuste erróneo por el umbral de 30 m de la Decisión 7)
- [x] 7.2 Exportar esa misma ruta a GPX desde el detalle en el dispositivo real, confirmando que se ofrece guardar/compartir con el selector nativo. (confirmado con `@tauri-apps/plugin-dialog` — ver gap real encontrado más abajo; Web Share API y `<a download>` no funcionan en el WebView de Android de Tauri)
- [x] 7.3 Repetir la sincronización con el servicio `osrm` parado, para confirmar el fallback a puntos crudos sin errores visibles al usuario. (confirmado — y encontrado+corregido un bug real: sin timeout en el cliente HTTP a OSRM en `main.go`, la petición se colgaba hasta el corte de 8s del móvil en vez de fallar en best-effort)

## 9. Ajustes reales encontrados en la verificación en dispositivo (fuera del alcance original)

- [x] 9.1 Fix: `mapmatch.Client` en `cmd/api/main.go` sin `HTTPClient` con timeout — colgaba con `osrm` caído en vez de fallar best-effort (ver [[ADR-051]] Consecuencias). `http.Client{Timeout: 5s}` añadido.
- [x] 9.2 Cambio de mecanismo de guardado en Android: Web Share API/`<a download>` no funcionan en el WebView de Tauri (confirmado con Chrome DevTools Protocol) — sustituido por `@tauri-apps/plugin-dialog` (`save()`) + `@tauri-apps/plugin-fs` (`writeFile()`), nueva dependencia (ver [[ADR-052]]). Permiso `dialog:allow-save` añadido a `capabilities/default.json`.
- [x] 9.3 Rediseño de la fila de acciones de `route-detail` (favorito/subir/compartir/exportar) a petición del usuario: solo iconos, sin etiqueta de texto (los 4 pills de ancho desigual rompían mal de línea) — clases `.detail-actions-row .favorite-icon`/`.sync-icon-btn` (pill) y `.detail-action__label` eliminadas de `route-detail.element.css`, `withLabel()` eliminado de `route-detail-header.ts`.
- [x] 9.4 El botón "Exportar" abre un menú de formato (reutiliza `confirmDialog`, con solo "GPX" hoy) en vez de exportar directamente — preparado para más formatos sin rediseñar el botón, a petición del usuario.
- [x] 9.5 Tests actualizados/añadidos para 9.1-9.4: `config_test.go` (timeout no testeable directamente, cubierto por el propio wiring), `route-detail-export.spec.ts` (menú de formato + rama Tauri con `plugin-dialog`), `route-detail-header.spec.ts` (aria-label en vez de texto visible), `capabilities-allowlist.spec.ts` (`dialog:allow-save` añadido a la lista conocida), `route-gpx-export.cy.ts` (click en la acción del menú antes de esperar la petición).

## 8. Cierre

- [x] 8.1 Suite completa en verde: `go test ./...`, Vitest, Clippy/cargo test si aplica, Cypress. (Go 231/231 + govulncheck limpio, Vitest 1219/1219 con ~97% cobertura, Cypress 77/77, cargo test/clippy/fmt sin cambios)
- [x] 8.2 Actualizar `memory/context.md` con el resumen de la sesión (estado de la normalización y exportación, resultado de la verificación en dispositivo). (verificación de dispositivo completada de punta a punta — grupo 7 y grupo 9 documentados)
- [x] 8.3 Revisar el diff completo antes de abrir el PR buscando cualquier dato sensible filtrado (no aplica secreto nuevo, pero sí confirmar que no se versiona el extracto OSM ni los ficheros `.osrm` generados, ni la IP de LAN personal usada para las pruebas). (diff revisado: sin secretos, `infra/docker/osrm/data/` gitignored, config temporal de red revertida)
