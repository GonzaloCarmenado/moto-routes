# Feature: Mejoras de Integración Fotos–Mapa (Pestañas, Galería en Cuadrícula y Trazado en Listado)

## Descripción
Mejora la integración visual entre las fotos de una ruta y su mapa/listado, apoyándose en lo ya construido por `fotos-ruta` (marcadores, clustering, popup con miniatura) y `mejoras-usabilidad` (`<photo-gallery>`, `<photo-viewer>`). Introduce un componente compartido de pestañas para reorganizar el detalle de ruta, rediseña la galería de fotos de ese detalle como una cuadrícula grande, permite abrir el visor completo de fotos directamente desde el popup de un marcador del mapa, y añade una previsualización ligera (silueta SVG) del trazado de cada ruta en las tarjetas del listado.

## Criterios de Aceptación

### Componente compartido de pestañas (`<tab-bar>`)
- [x] AC-001: Existe un componente compartido `<tab-bar>` en `src/shared/tab-bar/` que recibe una lista de pestañas (`{id, label}`) vía propiedad JS, y el contenido de cada panel vía `<slot name="{id}">` (cada llamador coloca sus nodos como hijos ligeros de `<tab-bar>` marcados con el atributo `slot` correspondiente al `id` de la pestaña). Renderiza: una fila de botones de pestaña (cada uno con hitbox mínima 56×56px y `data-cy="tab-bar-btn-<id>"`) y el panel correspondiente a la pestaña activa. _(test: tab-bar.element.spec.ts)_
- [x] AC-002: Al pulsar una pestaña distinta de la activa, esta se marca visualmente como activa (acento `--amber`/`--amber-strong`) y se muestra su panel; los paneles no activos quedan ocultos pero no se destruyen del DOM (no se pierde su estado interno, ej. scroll). _(test: tab-bar.element.spec.ts)_
- [x] AC-003: El tab-bar es accesible: usa `role="tablist"` en el contenedor y `role="tab"` + `aria-selected` en cada botón; cada botón es un `<button>` real, operable con teclado (Tab para llegar, Enter/Espacio para activar). _(test: tab-bar.element.spec.ts)_
- [x] AC-004: El tab-bar es agnóstico del dominio — no conoce fotos, rutas ni ningún dato de negocio concreto — y queda listo para reutilizarse en features futuras además de `<route-detail>`. _(por construcción: cero imports de dominio en tab-bar.element.ts; test: tab-bar.element.spec.ts)_

### Redesign de `<route-detail>` con pestañas
- [x] AC-005: `<route-detail>` mantiene el mapa y el bloque de cabecera (título, fecha, grid de estadísticas) fuera de las pestañas, siempre visibles; debajo se monta un `<tab-bar>` con al menos 3 pestañas: "Fotos", "Estadísticas" y "Notas". _(test: route-detail.element.spec.ts → "mounts a tab-bar with 'Fotos', 'Estadísticas' y 'Notas'...")_
- [x] AC-006: La pestaña "Fotos" contiene la galería de fotos rediseñada en cuadrícula (ver sección siguiente) y es la pestaña activa por defecto al abrir el detalle de una ruta. _(test: route-detail.element.spec.ts → "mounts a tab-bar...", aria-selected="true" en fotos)_
- [x] AC-007: Las pestañas "Estadísticas" y "Notas" son ejemplos estructurales sin funcionalidad real: "Estadísticas" reutiliza tal cual el placeholder de gráfica ya existente ("Velocidad durante la ruta (próximamente)"); "Notas" muestra un texto de ejemplo estático (tipo lorem ipsum) indicando que el contenido real llegará en una futura iteración. Ninguna de las dos debe interpretarse como alcance funcional de esta spec — solo demuestran que el patrón de pestañas generaliza a más de un uso. _(test: route-detail.element.spec.ts → "shows the existing chart placeholder unchanged...", "shows a static example placeholder text in 'Notas'...")_
- [x] AC-008: Cambiar de pestaña en `<route-detail>` no vuelve a pedir las fotos al repositorio ni reconstruye el mapa — solo cambia qué panel es visible. _(test: route-detail.element.spec.ts → "does not refetch photos/points when switching...", "does not reinstantiate route-map when switching tabs...")_

### Galería de fotos en cuadrícula ("estilo Instagram")
- [x] AC-009: Dentro de la pestaña "Fotos", las miniaturas se muestran en una cuadrícula responsiva: 2 columnas en viewport estrecho (móvil) y 3 columnas en viewport ancho, con miniaturas cuadradas notablemente más grandes que las 80×80px actuales de la tira horizontal. _(CSS: `photo-gallery.element.css` → `.photo-gallery--grid`, 2 cols mobile-first / 3 cols desde `min-width: 480px`, miniatura `aspect-ratio: 1` escalando con el ancho de columna; test: photo-gallery.element.spec.ts → "adds the grid modifier class...")_
- [x] AC-010: `<photo-gallery>` gana una propiedad `layout` (`'strip' | 'grid'`, valor por defecto `'strip'` para no romper el uso existente en `<cockpit-view>`) que alterna entre la tira horizontal existente y la cuadrícula nueva, sin duplicar la lógica de selección de miniatura: ambos layouts siguen emitiendo el mismo evento `photo-gallery:select` con el índice pulsado. _(test: photo-gallery.element.spec.ts → "keeps the existing horizontal strip container class by default...", "still emits photo-gallery:select with the clicked index when layout is 'grid'...")_
- [x] AC-011: Pulsar una miniatura de la cuadrícula abre `<photo-viewer>` exactamente igual que pulsar una de la tira horizontal (mismo evento, mismo wiring en `route-detail.element.ts`), sin lógica de apertura duplicada. _(por construcción: `buildThumbnail()` no se toca, mismo click handler/evento para ambos layouts; `route-detail.element.ts` sigue abriendo `<photo-viewer>` desde el mismo listener de `PHOTO_GALLERY_SELECT_EVENT`; test: photo-gallery.element.spec.ts → "still emits photo-gallery:select...")_
- [x] AC-012: El estado vacío ("Sin fotos") se muestra igual en ambos layouts de `<photo-gallery>`, centrado dentro del panel de la pestaña "Fotos". _(test: photo-gallery.element.spec.ts → "shows the same 'Sin fotos' empty state regardless of layout ('grid')")_
- [x] AC-013: Las miniaturas de la cuadrícula respetan la hitbox mínima de 56×56px como área pulsable, incluso en el layout de 3 columnas sobre un viewport estrecho (ej. 360px de ancho). _(CSS-only por construcción: `.photo-gallery--grid .photo-thumbnail` usa `min-width`/`min-height: var(--hitbox-min)`; **no verificado por un test unitario** — jsdom no ejecuta un motor de layout real y no puede medir tamaño renderizado en píxeles, ver nota del Paso 3 del plan; pendiente verificación visual manual/Cypress)_

### Popup de marcador de foto → visor completo (delta sobre `fotos-ruta`)
- [x] AC-014: El popup que ya se muestra al pulsar un marcador de foto individual en `<route-map>` (`showPhotoPopup`) sigue mostrando la miniatura de 120×120 existente sin cambios de tamaño ni de disparo (no se toca cuándo/cómo se abre el popup). _(test: route-map.element.spec.ts → "keeps the popup open on the same trigger as before, with the existing 120x120 thumbnail size unchanged (regression AC-014)")_
- [x] AC-015: La miniatura dentro de ese popup pasa a ser pulsable. Al pulsarla se abre `<photo-viewer>` (el mismo componente compartido, sin reimplementar nada) con la lista completa de fotos de la ruta y `startIndex` igual al índice de esa foto concreta dentro de esa lista, permitiendo hacer swipe/navegar al resto de fotos desde ahí. _(`route-map.element.ts#showPhotoPopup` añade un listener de click a la `<img>` que emite `route-map:photo-select`; `route-detail.element.ts#buildMap` lo escucha y abre el visor vía `openPhotoViewerAt`. Test: route-map.element.spec.ts, route-detail.element.spec.ts)_
- [x] AC-016: `<route-detail>` pasa a `<route-map>` la lista completa de fotos con su URL ya resuelta (la misma que ya usa para pintar marcadores), para que `<route-map>` pueda delegar la apertura del visor sin resolver URLs por su cuenta ni duplicar el pipeline de persistencia de fotos. _(verificado sin cambios de código: `buildMap()` en `route-detail.element.ts` ya asignaba `routeMap.photos = this._photos` desde antes de este paso, y `this._photos` ya era `PhotoWithUrl[]` con `objectUrl` resuelto — se añadió un test explícito en vez de darlo por hecho, mismo criterio que el spec-drift documentado en ADR-024. Test: route-detail.element.spec.ts → "passes the full list of photos with objectUrl already resolved to <route-map>...")_
- [x] AC-017: El popup de un marcador de **cluster** (varias fotos agrupadas) no cambia de comportamiento en esta spec — sigue haciendo zoom al área como ya hace hoy; abrir el visor completo desde un clic solo aplica a marcadores individuales. _(`addPhotoMarkers()` en `route-map-photos.ts` no invoca `onPhotoClick` para clusters, sin cambios; test explícito de regresión: route-map.element.spec.ts → "still calls map.flyTo and does not dispatch route-map:photo-select when a cluster marker is clicked...")_
- [x] AC-018: Cerrar el visor abierto desde el popup del mapa (botón X, tecla ESC, o clic en el fondo) no altera el estado del mapa subyacente: el mapa conserva su centro y nivel de zoom tal como estaban antes de abrir el visor. _(por construcción: `<photo-viewer>` es un elemento aparte montado en `document.body`, sin ninguna referencia a `mapInstance`; test: route-detail.element.spec.ts → "does not change the map state (no extra flyTo/fitBounds calls) after opening and closing the viewer from the popup event")_

### Previsualización de trazado en `<route-list>`
- [x] AC-019: Al persistir una ruta como `completed` (mismo punto donde hoy se guarda el estado final tras el long-press de parada), se calcula una versión simplificada del trazado (aprox. 20-40 puntos) a partir de los `route_points` completos de la ruta, mediante decimación uniforme (se conserva 1 de cada N puntos, con N ajustado para no bajar de 20 ni superar 40 puntos, preservando siempre el primer y el último punto). _(`persistRouteOnStop()` en `cockpit.service.ts` llama a `simplifyPolyline(state.points)` y luego a `repository.updatePreviewPolyline(state.routeId, previewPolyline)` como sentencia independiente, sin encadenar con `save(...)`; test: cockpit.service.spec.ts → "should persist a simplified previewPolyline (max ~40 points, matching first/last recorded GPS point) on confirmSaveRecording (AC-019)", "should persist an empty previewPolyline without breaking the rest of the save when no GPS point was recorded")_
- [x] AC-020: El trazado simplificado se guarda como una nueva columna JSON (`preview_polyline`, array de pares `[lat, lng]`) en la tabla `routes`. No es una imagen ni un mapa en vivo — es un dato derivado, recalculable en cualquier momento. _(`Route.previewPolyline: [number, number][] | null` en `route.types.ts`; `IRouteRepository.updatePreviewPolyline()` en `route.repository.ts`, implementado en `MemoryRouteRepository`/`SqliteRouteRepository` (columna `preview_polyline TEXT`, JSON serializado); test: route.repository.spec.ts → "should default previewPolyline to null...", "should persist and retrieve previewPolyline via updatePreviewPolyline...", "should NOT wipe previewPolyline on a subsequent save() call..." (regresión ADR-020/ADR-023))_
- [x] AC-021: Cada `.route-card` en `<route-list>` que tiene `preview_polyline` disponible renderiza esa silueta como un SVG inline (un `<path>` fino), coloreado con el token de acento `--amber`, escalado para caber en el recuadro de la tarjeta, sin ningún mapa de fondo ni tiles. _(`route-list.element.ts#buildThumb()`/`buildTraceThumb()` vía `buildPolylineSvgPath()` de `route-list.transform.ts`; CSS `.thumb--trace path` con `stroke: var(--amber)`; test: route-list.element.spec.ts → "renders an svg with a path inside .thumb, without the media-placeholder class, when previewPolyline is already saved (AC-021)")_
- [x] AC-022: Las rutas ya existentes en la base de datos (creadas antes de esta feature) que no tengan `preview_polyline` guardado muestran la tarjeta con el placeholder de franjas diagonales existente en lugar de fallar o mostrar un trazado vacío/roto. _(test: route-list.element.spec.ts → "keeps showing the striped placeholder without throwing when the route has neither previewPolyline nor route_points (AC-022, AC-024)")_
- [x] AC-023: Al abrir el listado, si una ruta no tiene `preview_polyline` pero sí tiene `route_points` persistidos, se calcula el trazado simplificado en ese momento y se persiste en segundo plano (sin bloquear el render de la tarjeta, que muestra el placeholder mientras tanto); en la siguiente carga del listado esa ruta ya muestra el trazado SVG sin recalcularlo de nuevo. _(`route-list.element.ts#scheduleBackfill()` lanza `ensurePreviewPolyline()` sin `await`; test: route-list.element.spec.ts → "shows the placeholder on first render, then swaps to the svg once the background backfill resolves, without recomputing on a second load (AC-023, AC-031)")_
- [x] AC-024: Si una ruta no tiene ningún `route_point` persistido (caso raro, ej. ruta vacía o corrupta), la tarjeta muestra el placeholder existente sin errores visibles al usuario ni excepciones sin capturar. _(`ensurePreviewPolyline()` en `route-list-polyline.service.ts` devuelve `null` sin lanzar cuando `getPointsByRouteId` resuelve `[]`; test: route-list-polyline.service.spec.ts → "returns null without throwing and without persisting when there are no route_points (AC-024)"; route-list.element.spec.ts → "keeps showing the striped placeholder without throwing...")_
- [x] AC-025: La columna `preview_polyline` se añade de forma segura para instalaciones existentes: `ensureSchema()` comprueba si la columna ya existe (vía `PRAGMA table_info(routes)` o equivalente) y, si no, ejecuta `ALTER TABLE routes ADD COLUMN preview_polyline TEXT` — porque `CREATE TABLE IF NOT EXISTS` (patrón ya usado en `SqliteRouteRepository`) no modifica una tabla que ya existía antes de esta feature. _(`SqliteRouteRepository#ensurePreviewPolylineColumn()`, invocado al final de `ensureSchema()`; test: sqlite-route.repository.spec.ts → describe "preview_polyline column migration (AC-025, AC-032)", con mock `SqlDb` dedicado que simula una tabla `routes` preexistente sin la columna)_

### Tests
- [x] AC-026: Test unitario: `<tab-bar>` cambia el panel visible al pulsar cada botón de pestaña, y en todo momento solo un panel está visible. _(test: tab-bar.element.spec.ts)_
- [x] AC-027: Test unitario: `<route-detail>` renderiza las 3 pestañas ("Fotos", "Estadísticas", "Notas") y "Fotos" es la activa por defecto. _(test: route-detail.element.spec.ts)_
- [x] AC-028: Test unitario: `<photo-gallery layout="grid">` renderiza las miniaturas en cuadrícula y emite `photo-gallery:select` con el mismo contrato que `layout="strip"`. _(test: photo-gallery.element.spec.ts → describe "layout property (AC-009, AC-010, AC-028)")_
- [x] AC-029: Test unitario: al pulsar la miniatura del popup de un marcador individual en `<route-map>`, se dispara la apertura del visor con el `startIndex` correspondiente a esa foto dentro de la lista completa. _(test: route-map.element.spec.ts → "dispatches route-map:photo-select with the clicked photo..."; route-detail.element.spec.ts → "opens photo-viewer at the matching index when route-map dispatches route-map:photo-select...")_
- [x] AC-030: Test unitario: la función de simplificado de trazado reduce un array de N puntos a un máximo de ~40 puntos, preservando siempre el primer y el último punto del recorrido original. _(test: route-polyline.service.spec.ts → "reduces 500 input points to at most ~40 points (and at least 20)", "preserves the exact first and last point of the input", "returns all points unchanged when fewer than 20 are given", "returns [] without throwing when given 0 points")_
- [x] AC-031: Test unitario: una ruta sin `preview_polyline` calcula y persiste el trazado la primera vez que se lista, y no lo recalcula en una segunda carga (repositorio mockeado, se verifica que la operación de guardado se invoca una sola vez). _(test: route-list-polyline.service.spec.ts → "computes and persists the polyline exactly once when the route has no previewPolyline but has points (AC-031)", "does not recompute on a second load when the route already has a previewPolyline (AC-031)"; route-list.element.spec.ts → "shows the placeholder on first render, then swaps to the svg once the background backfill resolves, without recomputing on a second load (AC-023, AC-031)")_
- [x] AC-032: Test unitario: `ensureSchema()` añade la columna `preview_polyline` a una tabla `routes` preexistente que no la tenía, sin perder ni alterar las filas ya insertadas. _(test: sqlite-route.repository.spec.ts → "runs ALTER TABLE exactly once when preview_polyline is missing from a preexisting routes table, keeping the existing row intact"; y "does not run ALTER TABLE when preview_polyline already exists")_

## Comportamiento Esperado

### Escenario: Ver detalle de ruta con pestañas (Happy Path)
- **Dado** que el usuario abre el detalle de una ruta guardada que tiene fotos asociadas
- **Cuando** la pantalla termina de cargar
- **Entonces** ve el mapa y la cabecera con el grid de estadísticas, seguidos de un tab-bar con "Fotos" activa por defecto mostrando la cuadrícula de miniaturas

### Escenario: Cambiar a una pestaña placeholder
- **Dado** que el detalle de ruta está abierto en la pestaña "Fotos"
- **Cuando** el usuario pulsa la pestaña "Notas"
- **Entonces** se muestra el contenido de ejemplo estático de "Notas", sin que se disparen nuevas llamadas al repositorio de fotos ni de rutas

### Escenario: Abrir una foto desde la cuadrícula
- **Dado** que la pestaña "Fotos" muestra 6 miniaturas en una cuadrícula de 3 columnas
- **Cuando** el usuario pulsa la cuarta miniatura
- **Entonces** se abre `<photo-viewer>` mostrando esa foto (índice 3) con navegación disponible al resto

### Escenario: Abrir el visor completo desde el popup del mapa
- **Dado** que una ruta tiene 5 fotos geolocalizadas y el mapa muestra el marcador individual de una de ellas
- **Cuando** el usuario pulsa el marcador (se abre el popup con la miniatura) y luego pulsa esa miniatura
- **Entonces** se abre `<photo-viewer>` con las 5 fotos de la ruta, posicionado en la foto correspondiente, permitiendo hacer swipe al resto

### Escenario: Cerrar el popup del mapa sin abrir el visor
- **Dado** que el popup de un marcador de foto está abierto
- **Cuando** el usuario pulsa en el mapa fuera del popup, sin tocar la miniatura
- **Entonces** el popup se cierra y no se abre ningún visor

### Escenario: Trazado en la tarjeta de una ruta recién guardada (Happy Path)
- **Dado** que el usuario acaba de completar y guardar una grabación con varios cientos de puntos GPS
- **Cuando** vuelve al listado de rutas
- **Entonces** la tarjeta de esa ruta muestra una silueta SVG en color ámbar del trazado, sin ningún mapa de fondo

### Escenario: Ruta antigua sin trazado guardado (backfill perezoso)
- **Dado** que una ruta fue creada antes de esta feature, no tiene `preview_polyline` en BBDD pero sí tiene `route_points` persistidos
- **Cuando** el usuario abre el listado de rutas por primera vez tras la actualización
- **Entonces** la tarjeta muestra inicialmente el placeholder de franjas, el trazado se calcula y persiste en segundo plano, y en la siguiente visita al listado esa misma tarjeta ya muestra el trazado SVG

### Escenario: Ruta sin ningún punto GPS
- **Dado** que una ruta guardada no tiene ningún `route_point` asociado
- **Cuando** el usuario abre el listado de rutas
- **Entonces** la tarjeta muestra el placeholder de franjas diagonales existente, sin errores visibles

### Escenario: Migración de esquema en una instalación ya existente
- **Dado** una base de datos SQLite ya existente cuya tabla `routes` no tiene la columna `preview_polyline`
- **Cuando** la app arranca y ejecuta `ensureSchema()`
- **Entonces** la columna se añade sin borrar ni alterar ninguna fila existente, y el resto de operaciones sobre `routes` sigue funcionando con normalidad

## Constraints
- El `<tab-bar>` es un componente compartido en `src/shared/`, sin ninguna lógica de negocio de rutas o fotos.
- Las pestañas "Estadísticas" y "Notas" son placeholders explícitos y quedan fuera de alcance funcional de esta spec — no se implementa lógica real para ellas.
- La cuadrícula de fotos reutiliza `<photo-viewer>` sin cambios de comportamiento; solo cambia qué datos se le pasan y desde dónde se invoca.
- El trazado de las tarjetas del listado no depende de red (sin tiles, sin mapa en vivo) ni de imágenes rasterizadas guardadas en disco — es siempre un SVG calculado a partir de `preview_polyline`.
- `preview_polyline` es un dato derivado de `route_points`, recalculable en cualquier momento — nunca la fuente de verdad de la geometría de la ruta.
- Todo elemento interactivo nuevo lleva `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` (ver `docs/07-cypress-e2e.md`).
- Solo tokens de `tokens.css` (`--amber` para el trazo SVG y las pestañas activas, `--panel`/`--panel-sunken` para superficies, etc.); prohibido hardcodear color y prohibido usar `--color-*`/`--glow-*`/`--neon-*` (ver ADR-019).
- Hitbox mínima 56×56px en botones de pestaña y en cada miniatura interactiva de la cuadrícula.
- Modo oscuro obligatorio; se respeta `prefers-reduced-motion` en la transición entre pestañas.

## Dependencias
- **[[fotos-ruta]]**: esta spec es un delta, no una reconstrucción, de los marcadores, el clustering y el popup con miniatura ya implementados (AC-014 a AC-018 de `fotos-ruta`). No se toca el disparo del popup ni el clustering.
- **[[mejoras-usabilidad]]**: `<photo-gallery>` y `<photo-viewer>` ya existen en `src/shared/` y se extienden/reutilizan aquí, no se duplican. El módulo de feedback compartido no se ve afectado por esta spec.
- **[[mejoras-tecnicas]]**: el nuevo `<tab-bar>` y cualquier componente tocado deben extender `BaseElement` y usar `renderShadow`, siguiendo el patrón ya unificado.
- **Persistencia SQLite** (`SqliteRouteRepository`): AC-019/AC-020/AC-025 requieren tocar el esquema de la tabla `routes` y el punto donde se persiste el estado `completed` de una ruta (ver [[ADR-020]], patrón insertar-activa/actualizar-al-parar).
- **`MemoryRouteRepository`** (navegador/tests): debe soportar el mismo campo `preview_polyline` (sin necesidad de migración, al ser en memoria) para que listado y detalle funcionen igual en navegador que en Tauri.

## Notas de Implementación
- **API de `<tab-bar>` (✅ decidido con el usuario)**: el contenido de cada panel se pasa vía `<slot name="{id}">` nombrado por `id` de pestaña — cada llamador escribe sus nodos como hijos ligeros de `<tab-bar>` con el atributo `slot` correspondiente, patrón estándar de Web Components (declarativo, sin API imperativa de render). La lista de pestañas (`{id, label}`) sigue siendo una propiedad JS, solo el *contenido* de cada panel usa slots.
- **Algoritmo de simplificado de trazado (✅ decidido con el usuario)**: decimación uniforme (cada N puntos), confirmada como decisión definitiva sobre Douglas-Peucker — prioriza simplicidad/determinismo de implementación y testeo. Si en el futuro rutas con muchas curvas cerradas (puertos de montaña) muestran siluetas poco representativas, revisar entonces; no bloquea esta spec.
- **Backfill perezoso (AC-023)**: se optó por calcular y persistir en el primer render del listado (en vez de solo "no mostrar nada" para rutas antiguas) para que el listado converja a tener trazado en todas las rutas con puntos, sin requerir una migración de datos en batch aparte.
- **Migración de columna (AC-025)**: `CREATE TABLE IF NOT EXISTS` no altera una tabla que ya existe — es el mismo tipo de gap que causó el problema del `PRAGMA foreign_keys` documentado en [[ADR-023]]. El check-y-`ALTER TABLE` debe ejecutarse dentro de `ensureSchema()`, cubierto por test con una BBDD en memoria que ya tenga la tabla `routes` creada sin la columna nueva.
- **Punto de enganche del cálculo de `preview_polyline` (AC-019)**: mismo punto donde `confirmSaveRecordingAction`/el guardado final de la ruta persiste el estado `completed` (ver `cockpit.service.ts`), no en el insert inicial `active` — el trazado completo solo existe una vez terminada la grabación.
- **Desacoplo del popup del mapa (AC-015/AC-016)**: siguiendo el precedente de `<photo-gallery>` (que emite `photo-gallery:select` y deja que el llamador abra `<photo-viewer>`, sin importarlo directamente), `<route-map>` debería emitir un evento propio (ej. `route-map:photo-select`) en vez de importar `<photo-viewer>` directamente, dejando que `<route-detail>` sea quien decide abrir el visor. Mantiene a `<route-map>` desacoplado de la UI de visor, igual que hoy está desacoplado de la persistencia de fotos.
- **Extensión de `<photo-gallery>` (AC-010)**: añadir la propiedad `layout` sin tocar el evento `photo-gallery:select` ni el contrato `GalleryPhoto`; el CSS de la cuadrícula puede vivir en el mismo `photo-gallery.element.css` con una clase modificadora (`.photo-gallery--grid`), evitando un componente nuevo y la duplicación de wiring que ya advierte el brief.
