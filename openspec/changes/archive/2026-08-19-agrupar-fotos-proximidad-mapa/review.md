# Revisión — `agrupar-fotos-proximidad-mapa`

## CRÍTICO

Nada que un humano deba revisar con prioridad: sin secretos, sin cambios de CSP, sin inputs de usuario nuevos (el radio de 75m es una constante de código, no un valor introducido por el usuario). Cambio en `src/shared/route-map/route-map-photos.ts` (compartido): consumido hoy por `route-map.element.ts` y por el nuevo `route-detail-photo-proximity.ts` — ambos en `routes/detail/` y `shared/route-map/`, sin otro dominio que los importe (confirmado con `grep`). Sin dependencias nuevas. Ninguna norma del proyecto saltada: el límite de líneas de `route-detail.element.ts` se resolvió con extracción (`route-detail-photo-proximity.ts`, mismo patrón ya documentado en `CLAUDE.md` para `route-detail-notes.ts`), no con una excepción nueva en `eslint.config.js`.

## Verificación independiente

Releído cada fichero nuevo/tocado (no solo el resumen de la implementación) y vuelto a ejecutar la suite completa desde cero:

- `route-map-photos.ts` — `PHOTO_PROXIMITY_GROUP_RADIUS_METERS = 75` reutiliza `clusterPhotos()` tal cual existía, sin tocar su firma; confirmado que sigue desacoplado de `PHOTO_CLUSTER_RADIUS_METERS`/`photoClusterRadiusForZoom` (radio visual, sin cambios). El clic en un marcador-cluster pasa de `map.flyTo()` a invocar `onPhotoClick?.(cluster.photos[0])` — mismo callback que el marcador individual, confirmado en el diff que `map` sigue usándose (para `Marker(...).addTo(map)`, sin quedar como parámetro muerto).
- `route-detail-photo-proximity.ts` (nuevo) — función pura `groupPhotosByProximity(photos, clickedPhotoId)`: agrupa con `clusterPhotos`, localiza el cluster por `id`, ordena por `capturedAt` descendente (mismo orden que `MemoryPhotoRepository.getByRouteId()`, confirmado en el propio repositorio). JSDoc explica el porqué de la extracción (límite de líneas, no dominio propio).
- `route-detail.element.ts` — el listener de `ROUTE_MAP_PHOTO_SELECT_EVENT` usa `groupPhotosByProximity` + `openPhotoViewer` directamente; `openPhotoViewerAt(index)` queda intacto y sigue siendo el único punto de apertura para la cuadrícula de "Fotos" y la línea de tiempo (confirmado por `grep`, sin otras llamadas nuevas).
- `route-map.element.spec.ts` — la vieja regresión AC-017 ("cluster click → zoom, no visor") se sustituyó por la nueva expectativa, con comentario explicando que este cambio la invalida deliberadamente — no se tocó ningún otro test que siguiera pasando.
- `git diff --stat` sobre todo el cambio: confirmado que no toca `apps/api`, `infra/`, `src-tauri/`, ni ningún fichero fuera de `apps/mobile/src/routes/detail/`, `apps/mobile/src/shared/route-map/`, `openspec/`, `memory/`.
- Suite completa re-ejecutada de forma independiente: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio (0 warnings, incluido `max-lines`), `vitest run` **1217/1217**, `vitest run --coverage` **96.86% líneas / 90.73% branches / 95.14% funciones** (por encima del umbral del 80%).
- Cypress **no** se ha re-ejecutado esta sesión (Docker Desktop no estaba levantado). No supone un hueco real: ningún spec de Cypress existente ejercita el clic en un marcador de foto con coordenadas (`fotos.cy.ts::buildSeedPhoto` usa `latitude`/`longitude` `null` por defecto — sin coordenadas no se renderiza ningún marcador de foto en el mapa, `addPhotoMarkers` los filtra), así que no hay ninguna regresión de Cypress esperada por este cambio. El flujo real end-to-end (clic en el mapa con GPS real) sí se verificó, en dispositivo Android real, por el usuario (tarea 4.1 de `tasks.md`).

## Mapeo Requirement → Scenario → test

| Requirement | Scenario | Test |
|---|---|---|
| Agrupar fotos por proximidad GPS al abrir el visor desde el mapa | Marcador individual muestra solo las fotos cercanas | `route-detail.element.spec.ts` "opens the viewer with only the GPS-nearby photos..." + `route-detail-photo-proximity.spec.ts` "groups the clicked photo with its GPS-nearby photos..." |
| | Marcador-cluster abre el visor con esa zona, sin zoom | `route-map.element.spec.ts` "dispatches route-map:photo-select and does not call map.flyTo when a cluster marker is clicked" (evento correcto, sin `flyTo`) + los dos tests anteriores (el downstream de agrupación es el mismo, independiente del origen del clic) |
| | Foto sin vecinas abre el visor solo con ella | `route-detail.element.spec.ts` "opens the viewer with just that photo when it has no other route photo within 75m" + `route-detail-photo-proximity.spec.ts` "returns a single-photo group..." + `route-map-photos.spec.ts` "forms a single-photo group when no other route photo is within 75m" |
| | La vista general (cuadrícula/timeline) no cambia | `route-detail.element.spec.ts` "still opens the viewer with all route photos when selecting from the grid tab..." (regresión explícita) |
| (radio de 75m, base de los 4 escenarios) | Agrupa por debajo del radio / no agrupa en o por encima | `route-map-photos.spec.ts` "clusters photos just under the 75m radius" / "does not cluster photos at or beyond the 75m radius" |

4/4 escenarios del delta spec cubiertos por test automatizado (Vitest). Ninguno marcado como verificación manual en el propio delta spec — la verificación en Android real (tarea 4.1 de `tasks.md`) es una comprobación adicional del proyecto sobre GPS/mapa en dispositivo, no un escenario sin cobertura automatizada.

## Hallazgos

Ninguno bloqueante. Dos ajustes reales encontrados durante `apply`, ya corregidos:

- **Desviación de diseño, corregida antes de cerrar**: `design.md` proponía inicialmente un método privado `openPhotoViewerForMapPhoto` en `route-detail.element.ts`; al implementarlo, ese fichero superó `max-lines` de ESLint, así que la lógica se extrajo a `route-detail-photo-proximity.ts` y el listener quedó inline. `design.md`/`tasks.md` se actualizaron para reflejar la implementación real antes de archivar (Regla fundamental de `CLAUDE.md`: código y artefactos nunca desalineados).
- **Orden del grupo, no explicitado en la spec original**: el orden "por hora de captura" se fijó como más reciente primero (no cronológico ascendente) para ser consistente con `MemoryPhotoRepository.getByRouteId()`, ya usado por la cuadrícula y la timeline — un test preexistente lo detectó al implementar primero en orden ascendente. No contradice el delta spec (que no fija la dirección), documentado en `design.md`.

Ninguno de los dos alcanza el umbral de ADR (`rules.design`) — son detalles de implementación, no decisiones con alternativas evaluadas de peso arquitectónico.

## Veredicto

**APPROVED**

13/13 tareas de `tasks.md` completas, incluida la verificación manual en Android real (4.1, confirmada por el usuario). Suite completa en verde de forma independiente (Vitest 1217/1217, 96.86% líneas; `tsc`/ESLint limpios). Sin hallazgos de seguridad, sin desviaciones sin resolver de `design.md`, sin escenarios del delta spec pendientes. Cypress no re-ejecutado por Docker Desktop no levantado — justificado (ningún spec existente ejercita este flujo) y sin riesgo de regresión oculta. Listo para archivar y abrir PR.
