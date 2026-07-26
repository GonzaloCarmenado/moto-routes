# Plan de Implementación: Mejoras de Integración Fotos–Mapa (Pestañas, Galería en Cuadrícula y Trazado en Listado)

## Resumen de Tareas
| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Componente compartido `<tab-bar>` | `shared/tab-bar/` (+specs) | AC-001–004, AC-026 | Small |
| 2 | Redesign de `<route-detail>` con pestañas | `routes/route-detail.element.ts` (+css, +spec) | AC-005–008, AC-027 | Medium |
| 3 | Galería en cuadrícula (`layout="grid"`) | `shared/photo-gallery/` | AC-009–013, AC-028 | Small |
| 4 | Popup de marcador → visor completo | `shared/route-map/route-map.element.ts` (+css), `routes/route-detail.element.ts` | AC-014–018, AC-029 | Medium |
| 5 | Esquema `preview_polyline` — migración segura | `route.types.ts`, `route.repository.ts`, `memory-route.repository.ts`, `sqlite-route.repository.ts` (+specs) | AC-020, AC-025, AC-032 | Medium |
| 6 | Simplificado de trazado + enganche en `cockpit.service` | `shared/services/route-polyline.service.ts` (+spec), `cockpit/cockpit.service.ts` (+spec) | AC-019, AC-030 | Medium |
| 7 | Trazado SVG en `<route-list>` + backfill perezoso | `routes/route-list.transform.ts`, `routes/route-list-polyline.service.ts` (+specs), `routes/route-list.element.ts` (+css, +spec) | AC-021–024, AC-031 | Large |

**Orden por dependencias**: los Pasos 1–4 (pestañas/galería/mapa) y los Pasos 5–7 (trazado en listado) son dos bloques independientes entre sí — pueden desarrollarse en cualquier orden relativo o en paralelo. Dentro de cada bloque el orden es estricto: Paso 1 antes que 2 (route-detail consume `<tab-bar>`), 2 antes que 3 (la cuadrícula se monta dentro de la pestaña "Fotos" ya creada en el Paso 2), 4 puede ir en cualquier punto tras el Paso 2 (solo necesita que `<route-detail>` ya tenga su estructura de fotos resuelta) — se numera al final del bloque por proximidad temática con la galería. Dentro del segundo bloque: 5 antes que 6 (el hook de cockpit necesita `updatePreviewPolyline` ya existente en el repositorio), 6 antes que 7 solo por orden lógico de spec, pero 7 no depende funcionalmente de 6 (el backfill perezoso calcula el trazado de forma independiente si `cockpit.service` no lo hizo) — sí depende de 5 (esquema y método de repositorio).

---

## Paso 1: Componente compartido `<tab-bar>` — ✅ Completado
- **Objetivo**: Crear el componente de pestañas agnóstico de dominio en `src/shared/`, con contenido de panel vía `<slot name="{id}">` (API ya decidida con el usuario, ver "Notas de Implementación" de la spec) y lista de pestañas (`{id, label}`) como propiedad JS.
- **AC cubiertos**: AC-001, AC-002, AC-003, AC-004, AC-026
- **Tests a escribir** (primero, en `tab-bar.element.spec.ts`):
  - Test: con `tabs = [{id:'a',label:'A'},{id:'b',label:'B'}]` y dos hijos ligeros (`<div slot="a">`, `<div slot="b">`) añadidos como children del `<tab-bar>`, la pestaña `a` es la activa por defecto (primera de la lista) → panel `a` visible, panel `b` oculto (AC-002, AC-005/006 se apoyan en este comportamiento por defecto)
  - Test: al pulsar el botón de la pestaña `b` (`data-cy="tab-bar-btn-b"`), el panel `b` pasa a visible y el `a` a oculto; en todo momento solo un panel tiene `hidden`/`display` distinto de oculto (AC-002, AC-026)
  - Test: los nodos ligeros originales (ej. un hijo con un contador de estado interno, o simplemente la misma referencia de nodo) **no se destruyen** al cambiar de pestaña — comprobar que el mismo nodo DOM (`===`) sigue presente tras el cambio, solo cambia su visibilidad (AC-002)
  - Test: el contenedor de botones tiene `role="tablist"`; cada botón tiene `role="tab"` y `aria-selected="true"` solo en el activo; cada botón es un elemento `<button>` real (AC-003)
  - Test: cada botón de pestaña tiene hitbox mínima vía CSS (comprobar la clase/estilo aplicado, no un tamaño de layout real — jsdom no calcula layout; ver nota de limitación en Paso 3) y `data-cy="tab-bar-btn-<id>"` único por pestaña (AC-001)
- **Archivos a crear/modificar**:
  - `CREAR src/shared/tab-bar/tab-bar.element.ts`
  - `CREAR src/shared/tab-bar/tab-bar.element.css`
  - `CREAR src/shared/tab-bar/tab-bar.element.spec.ts`
- **Notas**: Extiende `BaseElement`/`renderShadow` (ADR-022). Propiedad `tabs: {id:string; label:string}[]` (setter dispara `render()`); estado interno `_activeId` inicializado a `tabs[0]?.id` la primera vez que se asignan `tabs` (no se resetea si `tabs` se reasigna con el mismo primer id — solo en el primer set). El shadow DOM renderiza, por cada tab, un contenedor `<div class="tab-bar__panel">` que envuelve un `<slot name="{id}">`; el toggle de "activo" es una clase (`.tab-bar__panel--active`) que alterna `display`, nunca se quita el nodo del DOM ni se vuelve a crear el `<slot>`. El `<tab-bar>` no importa nada de fotos/rutas — cero dependencias de dominio, cumpliendo AC-004. Sin lógica de teclado adicional: al ser `<button>` reales, Tab/Enter/Espacio ya funcionan de forma nativa sin JS extra (AC-003 se cumple "gratis").

## Paso 2: Redesign de `<route-detail>` con pestañas — ✅ Completado
- **Objetivo**: Mover el mapa/cabecera fuera de las pestañas (ya lo están hoy) y envolver "Estadísticas" (placeholder de gráfica ya existente) y "Fotos"/"Notas" en un `<tab-bar>` con 3 pestañas, sin recargar fotos/mapa al cambiar de pestaña.
- **AC cubiertos**: AC-005, AC-006, AC-007, AC-008, AC-027
- **Tests a escribir** (primero, en `route-detail.element.spec.ts`):
  - Test: tras cargar una ruta, `<tab-bar>` está montado con 3 botones (`tab-bar-btn-fotos`, `tab-bar-btn-estadisticas`, `tab-bar-btn-notas`) y "Fotos" es la pestaña activa por defecto (AC-006, AC-027)
  - Test: la pestaña "Estadísticas" muestra el mismo placeholder ya existente (`.chart-area` con texto "(próximamente)"), sin cambios de comportamiento (AC-007)
  - Test: la pestaña "Notas" muestra un texto estático de ejemplo (usar la clase `.note-text` ya presente y sin uso en `route-detail.element.css` desde antes de esta spec) (AC-007)
  - Test: cambiar a la pestaña "Notas" y volver a "Fotos" **no** vuelve a llamar a `photoRepo.getByRouteId`/`repository.getPointsByRouteId` (espiar los métodos del repositorio pasado, contar invocaciones antes/después del cambio de pestaña) (AC-008)
  - Test: cambiar de pestaña no desmonta ni reconstruye `<route-map>` (mismo nodo DOM, o al menos: el mock de `maplibregl.Map` no se vuelve a instanciar — contar `mapCtor`/`Map` mock calls antes/después) (AC-008)
  - Regresión: las pruebas ya existentes de galería/visor de fotos (`galleryRoot(root)` = `root.querySelector('photo-gallery')!.shadowRoot!`) siguen pasando sin cambios — `<photo-gallery>` sigue siendo alcanzable vía `querySelector` desde el shadow root de `route-detail` aunque ahora sea nieto (hijo ligero de `<tab-bar>`, que es hijo del shadow root), porque `querySelector` atraviesa DOM ligero anidado dentro de elementos con su propio shadow root sin cruzar ese shadow root
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-detail.element.ts`: importar `'../shared/tab-bar/tab-bar.element.js'`; nuevo `buildTabBar()` que crea `<tab-bar>`, le asigna `.tabs = [{id:'fotos',label:'Fotos'},{id:'estadisticas',label:'Estadísticas'},{id:'notas',label:'Notas'}]` y le añade 3 hijos ligeros con `slot="fotos"|"estadisticas"|"notas"` (reutilizando `buildChart()` sin cambios para "Estadísticas", `buildPhotosSection()` adaptado para "Fotos", y un nuevo `buildNotasPlaceholder()` para "Notas"); `buildContent()` pasa a montar `buildHeader + buildStatGrid + buildTabBar()` (ya no `buildChart()`/`buildPhotosSection()` como hermanos sueltos)
  - `MODIFICAR`: `buildPhotosSection()` deja de devolver un `DocumentFragment` (los fragmentos no pueden llevar `slot`) y pasa a devolver un único `<div slot="fotos">` que envuelve label + botón de captura + `<photo-gallery>`; guardar la referencia (`this._fotosPanelEl`) para que `rerenderPhotosSection()` (usado tras añadir/borrar foto) reemplace ese nodo en vez de buscarlo por `.section-label` dentro de `.detail-content` (esa búsqueda ya no encontraría nada — el contenido ahora vive dentro del `<tab-bar>`)
  - `MODIFICAR src/routes/route-detail.element.css`: nuevas reglas mínimas si el layout de pestañas necesita algo distinto a `tab-bar.element.css` (probablemente no, dado que el slot es transparente al layout); conservar `.note-text` (ya existe, sin usar hasta ahora)
  - `MODIFICAR src/routes/route-detail.element.spec.ts`: nuevos tests arriba + ajuste de los tests existentes si la estructura de `.detail-content` cambia (los `data-cy` no cambian, así que la mayoría de asserts deberían seguir funcionando)
- **Notas**: Este paso es el más delicado del bloque de pestañas porque toca `rerenderPhotosSection()`, una función ya existente y con lógica de "borrar todo tras la última `.section-label` y reconstruir" — con el nuevo esquema de slot, lo más simple y menos frágil es sustituir esa heurística por una referencia directa al nodo del panel (`this._fotosPanelEl.replaceWith(this.buildPhotosSection())`), evitando depender de la posición relativa de elementos dentro de `.detail-content`. AC-007 dice explícitamente que "Estadísticas" y "Notas" son placeholders sin alcance funcional — no se debe inventar lógica real para ellas.

## Paso 3: Galería de fotos en cuadrícula (`<photo-gallery layout="grid">`) — ✅ Completado
- **Objetivo**: Añadir la propiedad `layout` (`'strip' | 'grid'`, por defecto `'strip'`) a `<photo-gallery>`, con una cuadrícula responsiva (2 cols móvil / 3 cols ancho) de miniaturas más grandes, sin duplicar la lógica de emisión de `photo-gallery:select` ni la del estado vacío.
- **AC cubiertos**: AC-009, AC-010, AC-011, AC-012, AC-013, AC-028
- **Tests a escribir** (primero, en `photo-gallery.element.spec.ts`):
  - Test: por defecto (`layout` no asignado), el contenedor sigue teniendo la clase de tira horizontal existente — regresión explícita de "no romper el uso existente en `<cockpit-view>`" (AC-010)
  - Test: con `el.layout = 'grid'`, el contenedor gana la clase `.photo-gallery--grid` (o equivalente) en vez de la de tira (AC-009, AC-010)
  - Test: con `layout='grid'`, pulsar la miniatura N sigue emitiendo `photo-gallery:select` con `{index: N}` — mismo test que ya existe para `strip`, parametrizado o duplicado para `grid` (AC-010, AC-011, AC-028)
  - Test: el estado vacío (`data-cy="photo-placeholder"`, texto "Sin fotos") se muestra igual con `layout='grid'` que con `layout='strip'` (AC-012)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/photo-gallery/photo-gallery.element.ts`: nueva propiedad `layout: 'strip' | 'grid'` (setter dispara `render()`, valor inicial `'strip'`); `buildGallery()` añade la clase modificadora `photo-gallery--grid` cuando `this._layout === 'grid'`; **`buildThumbnail()` no se toca** (mismo click handler, mismo evento) — la diferencia entre layouts es puramente CSS vía la clase modificadora en el contenedor
  - `MODIFICAR src/shared/photo-gallery/photo-gallery.element.css`: nueva regla `.photo-gallery--grid` (`display:grid`, `grid-template-columns: repeat(2, 1fr)` mobile-first, `@media (min-width: ...) { grid-template-columns: repeat(3, 1fr) }`), miniaturas cuadradas (`aspect-ratio: 1`) notablemente más grandes que 80px (ej. usar `1fr` de una cuadrícula, no un tamaño fijo en px, para que escale con el ancho del panel)
  - `MODIFICAR src/routes/route-detail.element.ts`: en `buildGalleryElement()`, asignar `gallery.layout = 'grid'` (solo en el uso de `<route-detail>`; el cockpit no se toca, sigue usando el valor por defecto `'strip'`)
  - `MODIFICAR src/shared/photo-gallery/photo-gallery.element.spec.ts`
- **Notas**: **Limitación de test conocida (AC-013)**: jsdom no ejecuta un motor de layout real, así que un test unitario no puede medir el tamaño en píxeles renderizado de una miniatura a 360px de ancho de viewport. La cobertura de AC-013 en esta fase es "por construcción" (usar `var(--hitbox-min)` como `min-width`/`min-height` en la regla CSS de `.photo-gallery--grid .photo-thumbnail`, garantizando el mínimo incluso si la cuadrícula fuera muy estrecha) más verificación visual manual/Cypress — dejar esto anotado explícitamente en el PR, no fingir que un test unitario ya lo cubre al 100%.
- **Implementado**: no existía ningún breakpoint `@media (min-width: …)` previo en el resto del proyecto (`tokens.css` no define un token de breakpoint, solo `@media (prefers-reduced-motion)`), así que se eligió `480px` (frontera común "móvil estrecho / móvil ancho o superior", sin inventar nada específico de esta feature) para pasar de 2 a 3 columnas — a revisar en verificación visual si un valor distinto encaja mejor con dispositivos reales. `buildGalleryElement()` en `route-detail.element.ts` tipa el elemento creado usando el nuevo tipo exportado `PhotoGalleryLayout` (en vez de repetir el literal `'strip' | 'grid'`) para no empujar el archivo por encima del límite de `max-lines` de ESLint (300 líneas, ya al límite tras el Paso 2).

## Paso 4: Popup de marcador de foto → visor completo (delta sobre `fotos-ruta`)
- **Objetivo**: Hacer pulsable la miniatura del popup de marcador individual (`showPhotoPopup`) para que `<route-map>` emita un evento propio (`route-map:photo-select`) que `<route-detail>` escucha para abrir `<photo-viewer>` en el índice correcto — sin que `<route-map>` importe ni conozca `<photo-viewer>`.
- **AC cubiertos**: AC-014, AC-015, AC-016, AC-017, AC-018, AC-029
- **Tests a escribir** (primero):
  - En `route-map.element.spec.ts` (extender el describe `marcadores de fotos`):
    - Test: al pulsar la `<img>` dentro del popup ya mostrado (reutiliza el test existente "shows a popup with the photo thumbnail..."), `<route-map>` dispara un evento `route-map:photo-select` con `detail.photo` igual al `MapPhoto` clicado (AC-015, AC-029)
    - Test (regresión AC-014): el popup se sigue abriendo con el mismo trigger de siempre (click en marcador individual) y la miniatura sigue siendo de 120×120 — verificar que no cambia el CSS/tamaño existente, solo se añade el listener de click
    - Test (regresión AC-017): pulsar un marcador de **cluster** sigue llamando `map.flyTo(...)` y **no** dispara `route-map:photo-select` (cluster nunca invoca `onPhotoClick`, ya es así hoy — test explícito de que no se dispara el nuevo evento en ese caso)
  - En `route-detail.element.spec.ts` (nuevo describe "integración mapa → visor de fotos"):
    - Test (AC-016, verificación sin cambio de código esperado): `<route-detail>` ya pasa a `<route-map>` la lista completa de `this._photos` con `objectUrl` resuelto vía `routeMap.photos = this._photos` (comprobar que el test de "integración con route-map" ya existente sigue reflejando esto, o añadir un assert explícito `routeMap.photos` si no lo hay)
    - Test (AC-015, AC-029): despachar manualmente `route-map:photo-select` con `detail: { photo }` sobre el `<route-map>` montado (mockeando maplibre-gl como ya hace este spec) abre `<photo-viewer>` en `document.body` con `startIndex` igual a la posición de esa foto dentro de `this._photos`
    - Test (AC-018): tras abrir y cerrar el visor (botón X) disparado desde ese evento, el mock de `maplibregl.Map` no recibe llamadas adicionales a `flyTo`/`fitBounds` — el mapa no se ve afectado por abrir/cerrar el visor
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: en `showPhotoPopup(photo)`, si `photo.objectUrl` existe, añadir `img.addEventListener('click', () => this.emit(ROUTE_MAP_PHOTO_SELECT_EVENT, { photo }))`; exportar `ROUTE_MAP_PHOTO_SELECT_EVENT = 'route-map:photo-select'` y `interface RouteMapPhotoSelectDetail { photo: MapPhoto }` (junto a la clase, como ya se hace con `PHOTO_GALLERY_SELECT_EVENT` en `photo-gallery.element.ts`)
  - `MODIFICAR src/shared/route-map/route-map.element.css`: `cursor: pointer` en la imagen del popup (indicar affordance de clic)
  - `MODIFICAR src/routes/route-detail.element.ts`: en `buildMap()`, añadir `routeMap.addEventListener(ROUTE_MAP_PHOTO_SELECT_EVENT, (e) => { const idx = this.toGalleryPhotos().findIndex(p => p.id === e.detail.photo.id); if (idx === -1) return; openPhotoViewer({ photos: this.toGalleryPhotos(), startIndex: idx, onDelete: (photo) => this.handleDeletePhoto(photo.id) }); })`
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`, `MODIFICAR src/routes/route-detail.element.spec.ts`
- **Notas**: **AC-016 puede resultar ser verificación pura, sin código nuevo** (mismo patrón que ISSUE de `fotos-ruta`/spec drift documentado en ADR-024): `buildMap()` en `route-detail.element.ts` ya asigna `routeMap.photos = this._photos` hoy, y `this._photos` ya son `PhotoWithUrl[]` con `objectUrl` resuelto — confirmar esto al implementar antes de tocar nada, y si es así, documentarlo igual que se hizo con AC-020 de `fotos-ruta`. El evento `route-map:photo-select` sigue el precedente de desacoplo ya usado por `photo-gallery:select` (Notas de Implementación de la spec): `<route-map>` reporta "qué foto se pulsó" y deja que el llamador decida abrir el visor, sin importar `photo-viewer.element.ts`.

## Paso 5: Esquema `preview_polyline` — migración segura de columna
- **Objetivo**: Añadir la columna `preview_polyline` (JSON de pares `[lat,lng]`) a la tabla `routes`, con migración segura vía `PRAGMA table_info` + `ALTER TABLE` (no solo `CREATE TABLE IF NOT EXISTS`, que no migra una tabla ya existente — mismo tipo de gap que el `PRAGMA foreign_keys` de ADR-023), y el método de repositorio para persistirla de forma independiente del resto de campos de la ruta.
- **AC cubiertos**: AC-020, AC-025, AC-032
- **Tests a escribir** (primero):
  - En `sqlite-route.repository.spec.ts` (test dedicado, con un mock `SqlDb` propio — el mock compartido `createMockDb()` de este archivo no modela `PRAGMA table_info`, así que no sirve para este caso):
    - Test: dado un mock `SqlDb` que simula una tabla `routes` **preexistente sin** la columna `preview_polyline` (con una fila ya insertada antes de instanciar el repositorio) y responde a `PRAGMA table_info(routes)` sin esa columna en la primera llamada, al llamar a cualquier método público (ej. `getAll()`) se ejecuta `ALTER TABLE routes ADD COLUMN preview_polyline TEXT` exactamente una vez, y la fila preexistente se sigue devolviendo intacta (mismos valores en el resto de columnas) (AC-025, AC-032)
    - Test: si `PRAGMA table_info(routes)` ya incluye `preview_polyline` (instalación nueva, tabla creada desde cero con el `CREATE TABLE IF NOT EXISTS` ya actualizado — decidir en implementación si el `CREATE TABLE` se actualiza para incluir la columna directamente en instalaciones nuevas, lo cual es válido y no contradice la necesidad del `ALTER TABLE` para instalaciones viejas), `ALTER TABLE` **no** se ejecuta
  - En `src/shared/models/route.repository.spec.ts` (suite de contrato, ejercitada contra Memory y Sqlite):
    - Test: una ruta recién guardada tiene `previewPolyline: null` por defecto
    - Test: `updatePreviewPolyline(routeId, polyline)` seguido de `getById(routeId)` devuelve `previewPolyline` igual al array pasado
    - Test (regresión anti-footgun, ver ADR-020/ADR-023 — este proyecto ya perdió datos por upserts que no preservaban campos): guardar una ruta, llamar a `updatePreviewPolyline`, y **luego volver a llamar a `save()`** con la misma id (como hace el flujo real de grabación: `active` → `completed`) — `previewPolyline` debe seguir presente tras ese segundo `save()`, no perderse
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/models/route.types.ts`: `Route.previewPolyline: [number, number][] | null` (no `readonly`, igual que `duration`/`totalDistance`); `CreateRoute` **no** se toca (el campo se gestiona vía el nuevo método de repositorio, no vía `save()`)
  - `MODIFICAR src/shared/models/route.repository.ts`: nuevo método en `IRouteRepository`: `updatePreviewPolyline(routeId: string, polyline: [number, number][]): Promise<void>`
  - `MODIFICAR src/shared/repositories/memory-route.repository.ts`: implementar `updatePreviewPolyline` (reemplaza la entrada del Map preservando el resto de campos); **corregir `save()`** para que el upsert preserve `previewPolyline` de la ruta existente (`previewPolyline: existing?.previewPolyline ?? null`) — si no, una llamada posterior a `save()` (ej. `active`→`completed`) borraría silenciosamente el trazado ya calculado, repitiendo la clase de bug de ADR-020/ADR-023
  - `MODIFICAR src/shared/repositories/sqlite-route.repository.ts`: nuevo método privado `ensurePreviewPolylineColumn()` (usa `this.db.select('PRAGMA table_info(routes);')`, comprueba si algún row tiene `name === 'preview_polyline'`, si no ejecuta `ALTER TABLE routes ADD COLUMN preview_polyline TEXT;`), invocado al final de `ensureSchema()`; `rowToRoute()` parsea `r.preview_polyline` (`JSON.parse(...)` si no es `null`); implementar `updatePreviewPolyline` con `UPDATE routes SET preview_polyline = ? WHERE id = ?` usando `JSON.stringify(polyline)`. `save()` en Sqlite **no** necesita tocarse para preservar el campo (su `UPDATE`/`INSERT` nunca listan `preview_polyline`, así que no lo sobrescriben)
  - `MODIFICAR src/shared/models/route.repository.spec.ts`, `MODIFICAR src/shared/repositories/sqlite-route.repository.spec.ts`
- **Notas**: El mock `SqlDb` compartido (`createMockDb()`) de `sqlite-route.repository.spec.ts` es deliberadamente simple (no modela `PRAGMA`) — para este paso hace falta un mock dedicado y más explícito, igual que se hizo en su día para el pragma de `foreign_keys` (que tampoco se pudo validar con ese mock, ver ADR-023 "Pendiente verificar en dispositivo Android real"). Aquí sí es posible testear el propio mecanismo de detección de columna (a diferencia del pragma de `foreign_keys`, que depende del motor SQLite real), así que no debe quedar como low-confidence — el test del `ALTER TABLE` puede y debe ser real con este mock dedicado.

## Paso 6: Simplificado de trazado + enganche en `cockpit.service`
- **Objetivo**: Función pura de decimación uniforme (20–40 puntos, preserva primer/último) y su uso en el punto donde se persiste la ruta como `completed`.
- **AC cubiertos**: AC-019, AC-030
- **Tests a escribir** (primero):
  - En `route-polyline.service.spec.ts`:
    - Test: con 500 puntos de entrada, el resultado tiene como máximo ~40 puntos (y al menos 20 si el algoritmo puede alcanzarlo) (AC-030)
    - Test: el primer y el último punto del resultado son exactamente el primer y el último punto de la entrada (misma lat/lng) (AC-030)
    - Test: con menos de 20 puntos de entrada, se devuelven todos tal cual (sin fabricar puntos que no existen)
    - Test: con 0 puntos, devuelve `[]` sin lanzar
  - En `cockpit.service.spec.ts` (extender el describe `createCockpitService with repository`):
    - Test: tras `startRecording()` con varios puntos GPS simulados (usar el mock de GPS ya existente en este archivo, alimentando N posiciones vía el callback de `watchPosition`) y `prepareStop()` + `confirmSaveRecording()`, `repo.getById(routeId)` devuelve `previewPolyline` no nulo, con como máximo ~40 puntos, cuyo primer/último punto coincide con el primer/último punto GPS registrado (AC-019)
    - Test: si no se registró ningún punto GPS (grabación parada inmediatamente), `previewPolyline` es `[]` (no lanza, no rompe el guardado del resto de la ruta)
- **Archivos a crear/modificar**:
  - `CREAR src/shared/services/route-polyline.service.ts` (`simplifyPolyline(points: {lat:number; lng:number}[]): [number, number][]`) — vive en `shared/` porque lo consumen tanto `cockpit` (al parar) como `routes` (backfill perezoso del Paso 7), no es específico de un dominio
  - `CREAR src/shared/services/route-polyline.service.spec.ts`
  - `MODIFICAR src/cockpit/cockpit.service.ts`: en `persistRouteOnStop()`, además de `repository.save(...)`, calcular `simplifyPolyline(state.points)` y llamar a `repository.updatePreviewPolyline(state.routeId, previewPolyline)` como una segunda operación independiente (ver nota sobre orden/concurrencia)
  - `MODIFICAR src/cockpit/cockpit.service.spec.ts`
- **Notas**: **Sin encadenar `save(...).then(() => updatePreviewPolyline(...))`** — se invocan como dos sentencias `await`-independientes (cada una con su propio `.catch()` de fallback), no una encima de la otra. Motivo, documentado aquí para no repetirlo como sorpresa en review: (1) para `MemoryRouteRepository`, cuyas mutaciones ocurren de forma síncrona dentro del cuerpo de la función aunque esté envuelta en una promesa, encadenar con `.then()` introduce un salto de microtarea que un test que hace `await repo.getById(...)` justo después de `confirmSaveRecording()` (patrón ya usado en los tests existentes de este archivo) no vería reflejado de forma fiable; llamando ambas como sentencias secuenciales normales, ambas mutan de forma síncrona en el orden de la llamada. (2) Para `SqliteRouteRepository` contra el driver real, ambas operaciones tocan columnas disjuntas (`status`/`duration`/… vs `preview_polyline`) de una fila que ya existe de antemano (insertada como `active` al empezar a grabar, ver ADR-020) — el orden relativo de dos `UPDATE` sobre columnas distintas de la misma fila no afecta al resultado final, así que no hace falta forzar secuencialidad para tener corrección. Si falla `updatePreviewPolyline` (ej. app cerrada a mitad), el backfill perezoso del Paso 7 lo recalculará en el próximo listado — no hace falta un fallback a `localStorage` específico para el trazado, solo para `route`/`points`/`stops` (ya existente).

## Paso 7: Trazado SVG en `<route-list>` + backfill perezoso
- **Objetivo**: Renderizar el trazado como `<svg><path>` ámbar en cada `.route-card` que tenga `preview_polyline`; para las que no lo tengan pero sí tengan `route_points`, calcularlo y persistirlo en segundo plano sin bloquear el render, mostrando el placeholder mientras tanto.
- **AC cubiertos**: AC-021, AC-022, AC-023, AC-024, AC-031
- **Tests a escribir** (primero):
  - En `route-list.transform.spec.ts` (nuevo, función pura de construcción del `path` SVG):
    - Test: con un `previewPolyline` de 2+ puntos, devuelve un string `d` de `<path>` no vacío
    - Test: con `null`/`[]`/1 solo punto, devuelve `null` (no se puede dibujar una línea) — el llamador debe caer al placeholder en ese caso
    - Test: los puntos de mayor latitud quedan en coordenadas Y menores dentro del `viewBox` (norte arriba, igual que un mapa normal — evitar el trazado "boca abajo")
  - En `route-list-polyline.service.spec.ts` (nuevo, orquestación de backfill perezoso):
    - Test (AC-031): con un repositorio mockeado (`getPointsByRouteId`, `updatePreviewPolyline` como `vi.fn()`) y una ruta sin `previewPolyline` pero con puntos, `ensurePreviewPolyline(repo, route)` llama a `updatePreviewPolyline` **exactamente una vez** y devuelve el trazado calculado
    - Test (AC-031, "no recalcula en una segunda carga"): con la misma ruta pero ahora con `previewPolyline` ya asignado, `ensurePreviewPolyline(repo, route)` **no** llama a `getPointsByRouteId` ni a `updatePreviewPolyline`, y devuelve directamente el `previewPolyline` ya presente
    - Test (AC-024): con una ruta sin `previewPolyline` y sin ningún `route_point` (`getPointsByRouteId` devuelve `[]`), `ensurePreviewPolyline` devuelve `null` sin lanzar y sin llamar a `updatePreviewPolyline`
  - En `route-list.element.spec.ts` (extender):
    - Test (AC-021): una ruta con `previewPolyline` ya guardado renderiza un `<svg>` con un `<path>` dentro de `.thumb` (ej. `data-cy="route-card-trace"`), sin la clase `media-placeholder`
    - Test (AC-022/AC-024): una ruta sin `previewPolyline` y sin `route_points` sigue mostrando el placeholder de franjas (`media-placeholder`) tras el intento de backfill, sin lanzar ninguna excepción no capturada
    - Test (AC-023): una ruta sin `previewPolyline` pero con `route_points` muestra el placeholder en el primer render síncrono, y tras el backfill asíncrono (esperar un tick) esa misma tarjeta pasa a mostrar el `<svg>` — verificar además que `repo.getById`/una segunda llamada a `fetchAndRender` (simulando "volver a abrir el listado") ya no dispara el cálculo de nuevo (spy sobre `updatePreviewPolyline` de la instancia de repositorio, llamado una sola vez en las dos cargas)
- **Archivos a crear/modificar**:
  - `CREAR src/routes/route-list.transform.ts` (`buildPolylineSvgPath(polyline, width, height): string | null`)
  - `CREAR src/routes/route-list.transform.spec.ts`
  - `CREAR src/routes/route-list-polyline.service.ts` (`ensurePreviewPolyline(repository: IRouteRepository, route: Route): Promise<[number, number][] | null>`)
  - `CREAR src/routes/route-list-polyline.service.spec.ts`
  - `MODIFICAR src/routes/route-list.element.ts`: `buildCard(route)` — si `route.previewPolyline` no está vacío, construir el `<svg>` vía `buildPolylineSvgPath` dentro de `.thumb`; si no, mostrar el placeholder existente **y** lanzar `ensurePreviewPolyline(this._repository, route)` en segundo plano (sin `await` en el render), que al resolver con un trazado no nulo localiza la tarjeta correspondiente (ej. `card.dataset.routeId = route.id`) y sustituye el contenido de su `.thumb` in-place, más actualiza `this._routes` en memoria para que una re-renderización posterior (ej. tras borrar otra ruta) ya no vuelva a mostrarla en placeholder
  - `MODIFICAR src/routes/route-list.element.css`: estilos de `.thumb--trace svg`/`path` (`stroke: var(--amber)`, `fill: none`, `stroke-width` fino, sin fondo)
  - `MODIFICAR src/routes/route-list.element.spec.ts`
- **Notas**: `ensurePreviewPolyline` es la única vía para decidir "ya tiene trazado / hay que calcularlo / no hay datos" — `route-list.element.ts` no debe reimplementar esa lógica de guarda inline. El backfill nunca bloquea el render de la tarjeta (se lanza sin `await`, el placeholder se pinta primero); si `updatePreviewPolyline` fallara silenciosamente, la tarjeta simplemente sigue en placeholder hasta la próxima carga del listado, sin romper nada — coherente con que `preview_polyline` es un dato derivado y recalculable (nunca la fuente de verdad, según los Constraints de la spec). La normalización de coordenadas a `viewBox` en `route-list.transform.ts` escala lat/lng de forma independiente en cada eje para caber en el recuadro (no preserva la proporción real de distancias, es una "silueta", no una proyección cartográfica fiel) — si en review se prefiere preservar aspect ratio real, es un cambio contenido a esa única función pura.

---

## Verificación final (tras completar todos los pasos)
- `pnpm lint` → 0 warnings/errores
- `pnpm test:coverage` → 100% pass, cobertura ≥ 80%
- `pnpm build` → sin errores
- `cargo fmt`/`clippy`/`test` → limpios (esta spec no toca Rust directamente, pero el pre-commit los ejecuta igual)
- Verificación visual (Cypress + screenshot o `/run`) de: cambio de pestañas en `<route-detail>` (incluida transición respetando `prefers-reduced-motion`), cuadrícula de fotos en móvil (2 cols) y ancho (3 cols) con hitbox real medible fuera de jsdom, apertura del visor desde el popup del mapa, y trazado SVG en tarjetas del listado (ruta nueva con trazado inmediato + ruta antigua con backfill perezoso visible en la segunda carga)
- Confirmar en dispositivo Android real (no solo mock `SqlDb`) que la migración `ALTER TABLE routes ADD COLUMN preview_polyline TEXT` no falla contra una base de datos ya existente con datos reales — mismo tipo de verificación pendiente que quedó anotada para el pragma de `foreign_keys` en ADR-023
- Ejecutar `review-agent` sobre `mejoras-fotos-mapa` (toca `shared/` con un componente nuevo reutilizable y el esquema de `routes` — no trivial)
