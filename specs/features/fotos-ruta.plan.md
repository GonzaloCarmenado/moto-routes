# Plan de Implementación: Fotos de Ruta

## Resumen de Tareas
| # | Tarea | Archivos | AC Cubiertos | Complejidad | Issue |
|---|-------|----------|--------------|-------------|-------|
| 1 | Modelo de datos y repositorio de fotos | 5 | AC-025, AC-026 | Medium | [#32](https://github.com/GonzaloCarmenado/moto-routes/issues/32) |
| 2 | Servicio de geolocalización de fotos (EXIF + ruta) | 2 | AC-005, AC-006, AC-007, AC-030 | Small | [#33](https://github.com/GonzaloCarmenado/moto-routes/issues/33) |
| 3 | Componente `<photo-capture>` — botón y menú Cámara/Galería | 5 | AC-001, AC-002, AC-004, AC-008, AC-029 | Medium | [#34](https://github.com/GonzaloCarmenado/moto-routes/issues/34) |
| 4 | Adaptador de plataforma (Tauri vs Navegador) | 3 | AC-022, AC-023, AC-024 | Medium | [#35](https://github.com/GonzaloCarmenado/moto-routes/issues/35) |
| 5 | Integración en `<cockpit-view>` — captura durante grabación | 3 | AC-008, AC-009, AC-010, AC-027 | Medium | [#36](https://github.com/GonzaloCarmenado/moto-routes/issues/36) |
| 6 | Integración en `<route-detail>` — captura y galería | 4 | AC-011, AC-012, AC-013, AC-028 | Medium | [#37](https://github.com/GonzaloCarmenado/moto-routes/issues/37) |
| 7 | Galería horizontal de fotos + placeholder | 3 | AC-019, AC-021, AC-032 | Small | [#38](https://github.com/GonzaloCarmenado/moto-routes/issues/38) |
| 8 | Visor/Lightbox `<photo-viewer>` | 3 | AC-020, AC-033 | Small | [#39](https://github.com/GonzaloCarmenado/moto-routes/issues/39) |
| 9 | Marcadores de fotos en `<route-map>` (MapLibre) | 3 | AC-014, AC-015 | Medium | [#40](https://github.com/GonzaloCarmenado/moto-routes/issues/40) |
| 10 | Clustering de marcadores en el mapa | 3 | AC-016, AC-017, AC-018, AC-031 | Medium | [#41](https://github.com/GonzaloCarmenado/moto-routes/issues/41) |
| 11 | Tests E2E con Cypress | 4 | AC-001–AC-021 (validación funcional) | Medium | [#42](https://github.com/GonzaloCarmenado/moto-routes/issues/42) |

---

## Paso 1: Modelo de datos y repositorio de fotos
- **Objetivo**: Definir los tipos `Photo` y `CreatePhoto`, e implementar `IPhotoRepository` con su implementación SQLite, creando la tabla `photos`.
- **AC cubiertos**: AC-025, AC-026
- **Tests a escribir**:
  - Test: `SqlitePhotoRepository` crea la tabla `photos` con las columnas esperadas (`id`, `route_id`, `file_path`, `latitude`, `longitude`, `captured_at`, `created_at`) → Valida AC-025
  - Test: `SqlitePhotoRepository.getByRouteId()` devuelve las fotos ordenadas por `captured_at` desc → Valida AC-026
  - Test: `SqlitePhotoRepository.add()` inserta una foto y la devuelve con `id` autogenerado → Valida AC-025
  - Test: `SqlitePhotoRepository.delete()` elimina una foto por `id` → Valida AC-025
  - Test: `SqlitePhotoRepository.countByRouteId()` devuelve el número de fotos de una ruta → Valida constraint de límite 100
- **Archivos a crear/modificar**:
  - `CREAR src/shared/models/photo.types.ts` — tipos `Photo`, `CreatePhoto` (sin `id` ni `created_at`)
  - `CREAR src/shared/models/photo.repository.ts` — interfaz `IPhotoRepository` (métodos: `add`, `getByRouteId`, `delete`, `countByRouteId`)
  - `CREAR src/shared/repositories/sqlite-photo.repository.ts` — implementación concreta usando `@tauri-apps/plugin-sql`
  - `CREAR src/shared/repositories/sqlite-photo.repository.spec.ts` — tests unitarios (mock del plugin SQL)
  - `CREAR src/shared/repositories/sqlite-photo.factory.ts` — factory para instanciar el repositorio con la conexión SQLite
  - `MODIFICAR src/shared/models/index.ts` — barrel export de `photo.types` y `photo.repository`
- **Notas**:
  - La tabla `photos` usa `TEXT` para IDs (UUID v4), `REAL` para lat/lon, `TEXT` ISO 8601 para timestamps.
  - La factory reutiliza el patrón de `sqlite-route.factory.ts` (misma conexión SQLite).
  - El repositorio debe ser inyectable (mismo patrón que `IRouteRepository`).
  - Tests usan mock del plugin SQL de Tauri (no requieren BBDD real).

---

## Paso 2: Servicio de geolocalización de fotos (EXIF + ruta)
- **Objetivo**: Crear un servicio puro que extraiga coordenadas GPS de EXIF y, como fallback, las derive de un punto de ruta o del centroide de la ruta.
- **AC cubiertos**: AC-005, AC-006, AC-007, AC-030
- **Tests a escribir**:
  - Test: Imagen con EXIF GPS → devuelve `{lat, lng}` del EXIF → Valida AC-005
  - Test: Imagen sin EXIF GPS + último punto de ruta → devuelve coordenadas del punto → Valida AC-006
  - Test: Imagen sin EXIF GPS + array de puntos de ruta → devuelve centroide (promedio lat/lng) → Valida AC-007, AC-013
  - Test: Imagen sin EXIF GPS + sin ruta activa ni puntos → devuelve `null` → Valida AC-007 (edge case)
  - Test: EXIF con datos GPS inválidos (out of range) → fallback a punto de ruta → Valida AC-030
- **Archivos a crear/modificar**:
  - `CREAR src/shared/services/photo-geolocation.service.ts` — función `extractPhotoLocation(file: File, fallbackPoint?: {lat, lng}, routePoints?: {lat, lng}[]): Promise<{lat: number, lng: number} | null>`
  - `CREAR src/shared/services/photo-geolocation.service.spec.ts` — tests unitarios (sin DOM, mock de `exifr`)
- **Notas**:
  - Usar `exifr` (librería ligera, sin dependencias nativas) para parsear EXIF.
  - `exifr.parse(file, { gps: true })` devuelve `{ latitude, longitude }` o `undefined`.
  - La función es pura (sin dependencias de Tauri ni DOM excepto el File pasado como argumento).
  - El centroide se calcula como promedio simple de todas las latitudes y longitudes de los puntos de la ruta.

---

## Paso 3: Componente `<photo-capture>` — botón y menú Cámara/Galería
- **Objetivo**: Crear un Web Component reutilizable que renderice el botón "Añadir foto" y el menú desplegable "Cámara" / "Galería".
- **AC cubiertos**: AC-001, AC-002, AC-004, AC-029
- **Tests a escribir**:
  - Test: `<photo-capture>` renderiza un botón con hitbox ≥ 56×56px → Valida AC-001
  - Test: Al pulsar el botón, se muestra un menú con dos opciones: "Cámara" y "Galería" → Valida AC-002
  - Test: Al pulsar fuera del menú o Escape, el menú se cierra → Valida AC-004
  - Test: Al seleccionar "Cámara", se dispara evento `photo-capture:select` con `{ source: 'camera' }` → Valida AC-002, AC-029
  - Test: Al seleccionar "Galería", se dispara evento `photo-capture:select` con `{ source: 'gallery' }` → Valida AC-002, AC-029
  - Test: El componente acepta propiedad `disabled` y deshabilita el botón → Valida constraint de límite 100
- **Archivos a crear/modificar**:
  - `CREAR src/photos/photo-capture.element.ts` — Web Component `<photo-capture>`
  - `CREAR src/photos/photo-capture.element.css` — estilos (botón con `--amber` / `--panel`, menú tipo popover, usa `tokens.css`)
  - `CREAR src/photos/photo-capture.element.spec.ts` — tests unitarios (Vitest + jsdom)
  - `CREAR src/photos/photo-capture.types.ts` — tipos: `CaptureSource`, `PhotoCaptureEvent`
  - `MODIFICAR src/shared/styles/tokens.css` — verificar que los tokens necesarios existen
- **Notas**:
  - El botón sigue el diseño "Asfalto Nocturno": fondo `--panel`, icono de cámara SVG en `--amber`, hitbox 56×56px.
  - El menú es un popover nativo (`popover` attribute) o un dropdown personalizado posicionado con `position: fixed`.
  - El componente no abre la cámara/galería directamente — emite un evento para que el consumidor (cockpit o route-detail) maneje la captura según la plataforma.
  - El dominio `photos/` sigue la convención de estructura por dominio funcional (ver `specs/ui/frontend-conventions.md`).

---

## Paso 4: Adaptador de plataforma (Tauri vs Navegador)
- **Objetivo**: Crear un servicio que abstraiga la captura de imágenes (cámara y galería) y funcione tanto en Tauri Android como en navegador.
- **AC cubiertos**: AC-022, AC-023, AC-024
- **Tests a escribir**:
  - Test: En entorno navegador, `captureFromCamera()` crea `<input type="file" accept="image/*" capture="environment">` → Valida AC-023
  - Test: En entorno navegador, `pickFromGallery()` crea `<input type="file" accept="image/*">` sin `capture` → Valida AC-023
  - Test: `isTauri()` devuelve `true` cuando `window.__TAURI_INTERNALS__` existe → Valida AC-024
  - Test: `isTauri()` devuelve `false` en navegador estándar → Valida AC-024
  - Test: En entorno Tauri, `captureFromCamera()` llama a `@tauri-apps/plugin-camera` → Valida AC-022
  - Test: En entorno Tauri, `pickFromGallery()` llama al plugin de file opener/dialog → Valida AC-022
- **Archivos a crear/modificar**:
  - `CREAR src/shared/services/photo-capture-adapter.service.ts` — funciones `captureFromCamera()`, `pickFromGallery()`, `isTauri()`
  - `CREAR src/shared/services/photo-capture-adapter.service.spec.ts` — tests unitarios
  - `MODIFICAR src-tauri/capabilities/default.json` — añadir permisos para `camera` y `dialog` si no existen
- **Notas**:
  - Detección Tauri: `window.__TAURI_INTERNALS__` o `@tauri-apps/api/core.isTauri()` (según versión de Tauri 2).
  - En navegador, ambas funciones devuelven `Promise<File>` usando el evento `change` del input.
  - En Tauri, `captureFromCamera` usa `@tauri-apps/plugin-camera` (getPhoto), `pickFromGallery` usa `@tauri-apps/plugin-dialog` (open con filtro de imágenes).
  - Si los plugins de Tauri no están disponibles, hacer fallback al método del navegador como safety net.
  - Validar formato JPEG/PNG en el archivo resultante (AC constraint: solo JPEG/PNG, máximo 20MB).

---

## Paso 5: Integración en `<cockpit-view>` — captura durante grabación
- **Objetivo**: Integrar el botón `<photo-capture>` en la pantalla de grabación y manejar el flujo completo de captura + persistencia durante la ruta activa.
- **AC cubiertos**: AC-008, AC-009, AC-010, AC-027
- **Tests a escribir**:
  - Test: `<cockpit-view>` muestra `<photo-capture>` cuando `state === 'recording'` → Valida AC-008, AC-027
  - Test: `<cockpit-view>` muestra `<photo-capture>` cuando `state === 'paused'` → Valida AC-008, AC-027
  - Test: `<cockpit-view>` NO muestra `<photo-capture>` cuando `state === 'idle'` → Valida AC-027
  - Test: Al capturar foto en cockpit, se llama a `photoRepository.add()` con los metadatos correctos (ruta activa, timestamp, coordenadas) → Valida AC-009
  - Test: Al capturar foto, se muestra un toast de confirmación durante 2-3 segundos → Valida AC-010
- **Archivos a crear/modificar**:
  - `CREAR src/cockpit/cockpit-photo.service.ts` — lógica de negocio: orquestar captura + geolocalización + persistencia
  - `CREAR src/cockpit/cockpit-photo.service.spec.ts` — tests unitarios
  - `MODIFICAR src/cockpit/cockpit.element.ts` — añadir `<photo-capture>` al template, manejar evento `photo-capture:select`
  - `MODIFICAR src/cockpit/cockpit.element.css` — espacio para el botón de foto (debajo de controles de grabación o en esquina)
  - `MODIFICAR src/cockpit/cockpit.service.ts` — exponer `getCurrentRouteId()` y `getLastPoint()` para el servicio de fotos
- **Notas**:
  - El botón de foto debe ser secundario (no compite con el botón maestro de grabación). Posición sugerida: esquina superior derecha o debajo del grid de stats.
  - Toast de confirmación: chip temporal en `--amber-soft` con miniatura pequeña, auto-desaparece en 3s.
  - La foto se guarda en `appDataDir/photos/<uuid>.jpg` usando Tauri filesystem API.
  - Para navegador, se almacena en memoria como base64 (no persistente, advertido en constraints).
  - La función `getLastPoint()` devuelve el último `RoutePoint` registrado para usar como fallback GPS.

---

## Paso 6: Integración en `<route-detail>` — captura y galería
- **Objetivo**: Integrar el botón `<photo-capture>` y la galería de fotos en la pantalla de detalle de ruta.
- **AC cubiertos**: AC-011, AC-012, AC-013, AC-028
- **Tests a escribir**:
  - Test: `<route-detail>` muestra `<photo-capture>` cuando tiene una ruta cargada → Valida AC-011, AC-028
  - Test: `<route-detail>` NO muestra `<photo-capture>` cuando `route === null` (ruta no encontrada) → Valida AC-028
  - Test: Al capturar foto en detail, se añade a la galería inmediatamente sin recargar → Valida AC-012
  - Test: Foto sin GPS en detail usa el centroide de la ruta → Valida AC-013
  - Test: Al llegar al límite de 100 fotos, el botón se deshabilita → Valida constraint
- **Archivos a crear/modificar**:
  - `CREAR src/routes/route-detail-photo.service.ts` — lógica de negocio para fotos en detalle
  - `CREAR src/routes/route-detail-photo.service.spec.ts` — tests unitarios
  - `MODIFICAR src/routes/route-detail.element.ts` — añadir `<photo-capture>`, sección de galería, cargar fotos desde repositorio
  - `MODIFICAR src/routes/route-detail.element.css` — estilos para la galería horizontal
- **Notas**:
  - Reemplazar el placeholder hardcodeado "Sin fotos" por la galería real del Paso 7.
  - El componente recibe `IPhotoRepository` por inyección (mismo patrón que `IRouteRepository`).
  - Las fotos añadidas desde detail se asocian a `route.id`.
  - El centroide de la ruta se calcula cargando `getPointsByRouteId(routeId)` y promediando lat/lng.
  - Si `getPointsByRouteId` devuelve vacío, la foto se guarda con coordenadas `null` (sin ubicación).

---

## Paso 7: Galería horizontal de fotos + placeholder
- **Objetivo**: Implementar la galería de fotos con scroll horizontal y el estado "Sin fotos" como Web Component o sección integrada en `<route-detail>`.
- **AC cubiertos**: AC-019, AC-021, AC-032
- **Tests a escribir**:
  - Test: Galería con 0 fotos muestra placeholder "Sin fotos" → Valida AC-021, AC-032
  - Test: Galería con N fotos renderiza N miniaturas ordenadas por timestamp → Valida AC-019
  - Test: Al añadir una foto, la galería se actualiza con N+1 miniaturas → Valida AC-012 (integración)
  - Test: Scroll horizontal funciona con snap points → Valida AC-019 (comportamiento visual)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-detail.element.ts` — lógica de renderizado de la galería
  - `MODIFICAR src/routes/route-detail.element.css` — estilos: `.photo-gallery`, `.photo-thumbnail`, `.photo-placeholder`
- **Notas**:
  - La galería es parte de `<route-detail>`, no un componente separado (por ahora solo se usa en detail).
  - Scroll horizontal nativo: `overflow-x: auto`, `scroll-snap-type: x mandatory`, `scroll-behavior: smooth`.
  - Las miniaturas cargan desde `file_path` (Tauri: `convertFileSrc()` para obtener URL accesible; navegador: base64 directamente).
  - `convertFileSrc` de `@tauri-apps/api/core` convierte rutas del app data dir a URLs accesibles por el WebView.
  - Tamaño de miniatura: ~80×80px con `border-radius: var(--r-sm)`, borde `--line`.
  - Placeholder: usa la clase `.media-placeholder` existente del design system (franjas diagonales + texto).

---

## Paso 8: Visor/Lightbox `<photo-viewer>`
- **Objetivo**: Crear un Web Component reutilizable para ver fotos a pantalla completa con navegación por swipe y botón de cierre.
- **AC cubiertos**: AC-020, AC-033
- **Tests a escribir**:
  - Test: `<photo-viewer>` con `open="true"` y `photos` poblado muestra la foto actual a pantalla completa → Valida AC-020
  - Test: Al pulsar botón X, se dispara evento `close` y el visor se cierra → Valida AC-033
  - Test: Al pulsar tecla Escape, se dispara evento `close` → Valida AC-020 (accesibilidad teclado)
  - Test: Al hacer swipe left, avanza a la siguiente foto → Valida AC-020
  - Test: Al hacer swipe right, retrocede a la foto anterior → Valida AC-020
  - Test: Recibe propiedad `initialIndex` y muestra la foto correcta al abrir → Valida AC-033
- **Archivos a crear/modificar**:
  - `CREAR src/shared/photo-viewer/photo-viewer.element.ts` — Web Component `<photo-viewer>`
  - `CREAR src/shared/photo-viewer/photo-viewer.element.css` — estilos (overlay oscuro, botón X, contenedor de imagen)
  - `CREAR src/shared/photo-viewer/photo-viewer.element.spec.ts` — tests unitarios
  - `MODIFICAR src/routes/route-detail.element.ts` — integrar `<photo-viewer>`, manejar click en miniatura
- **Notas**:
  - Va en `shared/` porque en el futuro podría reutilizarse desde el cockpit o un futuro perfil/galería global.
  - Overlay: fondo `rgba(0,0,0,0.95)`, botón X en esquina superior derecha con hitbox 56×56px.
  - Swipe: implementado con `touchstart`/`touchend` para detectar dirección, o `pointerdown`/`pointerup`.
  - Soporte para pinch-to-zoom: CSS `touch-action: pinch-zoom` + `transform: scale()` controlado por gestos.
  - Transiciones suaves entre fotos: `transform: translateX()` con `--transition-smooth`.
  - El componente recibe `photos: PhotoItem[]` (URL + caption opcional) y `initialIndex: number`.

---

## Paso 9: Marcadores de fotos en `<route-map>` (MapLibre)
- **Objetivo**: Añadir al componente `<route-map>` la capacidad de mostrar marcadores de fotos geolocalizadas sobre el mapa MapLibre.
- **AC cubiertos**: AC-014, AC-015
- **Tests a escribir**:
  - Test: `<route-map>` con `photos` poblado renderiza marcadores en las coordenadas de cada foto → Valida AC-014
  - Test: Los marcadores de foto usan color cobre/terracota (`--rust-line`) → Valida AC-014
  - Test: Al hacer click en un marcador, se muestra un popup con la miniatura de la foto → Valida AC-015
  - Test: `<route-map>` con `photos` vacío no renderiza marcadores → Valida AC-014 (edge)
- **Archivos a crear/modificar**:
  - `CREAR src/shared/route-map/route-map-photos.ts` — función `addPhotoMarkers(map, photos, onPhotoClick)` que añade capa de marcadores
  - `CREAR src/shared/route-map/route-map-photos.spec.ts` — tests unitarios
  - `MODIFICAR src/shared/route-map/route-map.element.ts` — añadir propiedad `photos`, llamar a `addPhotoMarkers` al recibir fotos
  - `MODIFICAR src/shared/route-map/route-map.transform.ts` — función `photosToGeoJSON(photos: Photo[])` → GeoJSON FeatureCollection
- **Notas**:
  - Los marcadores de foto se renderizan como una capa GeoJSON de tipo `circle` con `circle-color` resuelto desde `--rust-line` vía `getComputedStyle`.
  - Alternativa: usar `maplibregl.Marker` con elementos DOM personalizados para tener control total del estilo.
  - El popup usa `maplibregl.Popup` con contenido HTML que incluye la miniatura (`<img>` con `convertFileSrc` o base64).
  - Las fotos sin coordenadas (`lat: null, lng: null`) se ignoran al pintar marcadores.
  - El color cobre/terracota debe ser distinguible del verde (inicio) y ámbar (fin/ruta) — el token `--rust-line` (#2E2E2B con tinte óxido) puede necesitar un derivado más visible, ej. `--photo-marker: #B8653A`.

---

## Paso 10: Clustering de marcadores en el mapa
- **Objetivo**: Implementar agrupación de marcadores de fotos cercanas usando clustering a nivel de datos (sin dependencia de supercluster, implementación ligera).
- **AC cubiertos**: AC-016, AC-017, AC-018, AC-031
- **Tests a escribir**:
  - Test: Fotos a < 50m se agrupan en un cluster → Valida AC-016, AC-031
  - Test: Fotos a ≥ 50m no se agrupan → Valida AC-031
  - Test: El marcador de cluster muestra el número de fotos agrupadas → Valida AC-016
  - Test: Al hacer zoom in, los clusters se desagrupan cuando la distancia visual entre puntos supera el umbral → Valida AC-018
  - Test: Al pulsar un cluster, se despliega lista de miniaturas o se hace zoom → Valida AC-017
- **Archivos a crear/modificar**:
  - `CREAR src/shared/route-map/photo-cluster.ts` — algoritmo de clustering basado en distancia Haversine + nivel de zoom
  - `CREAR src/shared/route-map/photo-cluster.spec.ts` — tests unitarios
  - `MODIFICAR src/shared/route-map/route-map-photos.ts` — integrar clustering, escuchar evento `zoom` del mapa para reagrupar
  - `MODIFICAR src/shared/route-map/route-map.element.ts` — exponer callback `onClusterClick` para manejar interacción con clusters
- **Notas**:
  - Clustering basado en grid espacial: dividir el viewport en celdas de tamaño proporcional al zoom, agrupar fotos que caen en la misma celda.
  - Alternativa más simple: calcular distancia Haversine entre pares de fotos y agrupar las que están a < 50m. Recalcular en cada cambio de zoom.
  - No se recomienda instalar `supercluster` (añade peso) — la cantidad de fotos por ruta (máx 100) hace viable un algoritmo manual ligero.
  - El marcador de cluster usa un `L.divIcon` o `maplibregl.Marker` con un elemento DOM circular mostrando el número.
  - Radio de cluster: 50m (configurable vía constante).
  - Al pulsar un cluster, se puede hacer `map.flyTo({ center: clusterCenter, zoom: currentZoom + 2 })` o mostrar un popup con miniaturas.

---

## Paso 11: Tests E2E con Cypress
- **Objetivo**: Validar el flujo completo de captura y visualización de fotos de extremo a extremo en el navegador.
- **AC cubiertos**: AC-001 a AC-021 (validación funcional completa)
- **Tests a escribir**:
  - Test E2E: Flujo completo — iniciar grabación, añadir foto desde galería, detener ruta, verificar que la foto aparece en el detalle → Valida AC-008, AC-009, AC-011, AC-012
  - Test E2E: Menú Cámara/Galería se abre y cierra correctamente → Valida AC-002, AC-004, AC-029
  - Test E2E: Galería muestra placeholder "Sin fotos" en ruta sin fotos → Valida AC-021, AC-032
  - Test E2E: Galería muestra miniaturas al tener fotos → Valida AC-019
  - Test E2E: Lightbox se abre al pulsar miniatura y se cierra con X → Valida AC-020, AC-033
  - Test E2E: Marcadores de fotos visibles en el mapa del detalle → Valida AC-014, AC-015
  - Test E2E: Clustering agrupa/desagrupa al hacer zoom en el mapa → Valida AC-016, AC-018
  - Test E2E: Límite de 100 fotos — botón deshabilitado → Valida constraint de límite
- **Archivos a crear/modificar**:
  - `CREAR cypress/e2e/fotos-ruta/fotos-ruta.cy.ts` — suite de tests E2E
  - `CREAR cypress/fixtures/photo-geotagged.jpg` — foto de prueba con EXIF GPS (o mock)
  - `CREAR cypress/fixtures/photo-no-gps.jpg` — foto de prueba sin EXIF GPS
  - `CREAR cypress/support/photo-commands.ts` — custom commands: `addPhotoToRoute()`, `mockCamera()`, `mockGallery()`
  - `MODIFICAR cypress/support/e2e.ts` — importar photo-commands
- **Notas**:
  - Seguir convenciones de `docs/07-cypress-e2e.md`: `data-cy` en todos los elementos interactivos, selectores sin clase/ID, tests autocontenidos.
  - Mockear la cámara/galería en Cypress: usar `cy.stub()` para `photo-capture-adapter.service` o interceptar el input file.
  - Los tests son independientes del backend Tauri — se ejecutan en navegador con el fallback de `input[type=file]`.
  - `data-cy` necesarios:
    - `data-cy="photo-add-button"` — botón "Añadir foto"
    - `data-cy="photo-menu-camera"` — opción Cámara
    - `data-cy="photo-menu-gallery"` — opción Galería
    - `data-cy="photo-gallery"` — contenedor de la galería
    - `data-cy="photo-thumbnail"` — miniatura individual
    - `data-cy="photo-viewer"` — lightbox/visor
    - `data-cy="photo-viewer-close"` — botón X del visor
    - `data-cy="photo-marker"` — marcador de foto en mapa
    - `data-cy="photo-cluster"` — marcador de cluster
    - `data-cy="photo-toast"` — toast de confirmación en cockpit
    - `data-cy="photo-placeholder"` — placeholder "Sin fotos"