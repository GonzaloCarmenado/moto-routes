# Feature: Visualización de Ruta en Mapa (MapLibre + OpenFreeMap)

## Descripción
Rehacer desde cero la visualización de la ruta grabada sobre un mapa real. Reemplaza el mapa Leaflet actual (embebido en `<route-detail>`) por un componente de mapa reutilizable basado en **MapLibre GL JS** con teselas vectoriales de **OpenFreeMap** (gratis, sin API key). El mapa pinta los puntos GPS guardados en SQLite como un trazado preciso sobre las calles, con marcador de inicio y fin, y encuadra la ruta automáticamente. Las estadísticas del detalle (distancia, duración, velocidad media, desnivel) se mantienen tal cual están hoy.

Esta spec **sustituye** a `specs/features/mapa-ruta-leaflet.md` (Leaflet queda descartado).

## Criterios de Aceptación

### Dependencias y configuración
- [ ] AC-001: Se instala `maplibre-gl` como dependencia de producción. Se eliminan `leaflet` y `@types/leaflet` del `package.json` (ya no se usan).
- [ ] AC-002: La CSP de `src-tauri/tauri.conf.json` y la del `<meta>` de `index.html` se actualizan para MapLibre + OpenFreeMap y se retiran las entradas de OpenStreetMap raster (`*.tile.openstreetmap.org`). Debe permitir, como mínimo:
  - `connect-src` incluye `https://tiles.openfreemap.org` (estilo, teselas, glyphs y sprites se piden por fetch).
  - `worker-src 'self' blob:` (MapLibre crea Web Workers desde blob URLs).
  - `img-src 'self' data: blob: https://tiles.openfreemap.org`.
  - `style-src` sigue permitiendo `'unsafe-inline'` (ya presente).

### Componente reutilizable `<route-map>`
- [ ] AC-003: Existe un Web Component `<route-map>` en `src/shared/route-map/route-map.element.ts` con su CSS en `route-map.element.css`. Es reutilizable y **no depende** de `<route-detail>` ni de Tauri ni del repositorio SQL.
- [ ] AC-004: Recibe los puntos a pintar mediante una propiedad `points: { lat: number; lng: number }[]`. Al asignar los puntos, el componente (re)renderiza el mapa.
- [ ] AC-005: Renderiza un mapa MapLibre GL dentro de su contenedor usando teselas vectoriales de OpenFreeMap servidas **sin API key**, con un **estilo oscuro coherente con "Asfalto Nocturno"** (modo oscuro obligatorio).
- [ ] AC-006: Dibuja el trazado como una capa de línea (GeoJSON `LineString`) que une los puntos GPS **en crudo**, en el orden recibido (que ya viene ordenado por `timestamp`), con color ámbar (`--amber`) y grosor ≈ 4px.
- [ ] AC-007: Coloca un marcador de **inicio** (color distintivo verde) en el primer punto y un marcador de **fin** (ámbar) en el último punto.
- [ ] AC-008: Encuadra la cámara automáticamente a los límites del trazado (`fitBounds` de los puntos) con un padding de ~50px.
- [ ] AC-009: Al construir la geometría se respeta el orden de coordenadas de GeoJSON/MapLibre: `[lng, lat]` (opuesto al `[lat, lng]` de Leaflet). Un punto de la BBDD `{lat, lng}` debe caer exactamente sobre su calle.

### Estado sin datos GPS
- [ ] AC-010: Si `points` está vacío, el componente muestra un estado "Sin datos de GPS" superpuesto y **no** inicializa trazado ni marcadores.

### Ciclo de vida
- [ ] AC-011: Al recibir un nuevo conjunto de puntos o al desconectarse (`disconnectedCallback`), se destruye la instancia previa del mapa (`map.remove()`) para evitar fugas de memoria.

### Estilo (sistema de diseño "Asfalto Nocturno")
- [ ] AC-012: El contenedor del mapa usa tokens del sistema para radios (`--r-md`) y encaja en el layout del detalle (altura fija coherente con el diseño). Los colores del trazado y de los marcadores derivan de tokens (`--amber` para línea y fin; verde de inicio), resueltos en tiempo de ejecución vía `getComputedStyle` — **prohibido hardcodear colores** que ya existan como token.
- [ ] AC-013: El contenedor del mapa incluye `data-cy="route-map-container"` para tests E2E.

### Integración en `<route-detail>`
- [ ] AC-014: `<route-detail>` deja de usar Leaflet. Se elimina su método `buildMap` con lógica Leaflet y se sustituye por un `<route-map>` al que se le pasan los puntos obtenidos de `repository.getPointsByRouteId(routeId)`.
- [ ] AC-015: El resto del detalle se mantiene **sin cambios funcionales**: botón "← Volver", título/fecha, las 4 stat-tiles (distancia, duración, vel. media, desnivel `-- m`), y los placeholders de gráfica y fotos.

### Tests unitarios (Vitest, `maplibre-gl` mockeado)
- [ ] AC-016: Test: `<route-map>` con puntos inicializa el mapa (mock de `maplibre.Map`) y añade el trazado.
- [ ] AC-017: Test: `<route-map>` sin puntos muestra "Sin datos de GPS" y no inicializa el mapa.
- [ ] AC-018: Test: `<route-map>` destruye el mapa (`map.remove()`) al desconectarse del DOM.
- [ ] AC-019: Test: `<route-detail>` con una ruta y puntos renderiza un `<route-map>` y le transfiere los puntos cargados.

## Diseño de Componente

### Estructura de archivos
```
src/shared/route-map/
├── route-map.element.ts       # Web Component <route-map> (MapLibre)
├── route-map.element.css       # Estilos (importa tokens.css)
├── route-map.transform.ts      # Puntos {lat,lng} → GeoJSON [lng,lat] + cálculo de bounds
└── route-map.element.spec.ts   # Tests unitarios (mock de maplibre-gl)
```

### Modificaciones
```
src/routes/route-detail.element.ts  → quita Leaflet, usa <route-map>
src/routes/route-detail.element.css → ajusta .route-map al nuevo contenedor
src-tauri/tauri.conf.json            → CSP MapLibre + OpenFreeMap
index.html                           → CSP <meta> equivalente
package.json                         → +maplibre-gl, −leaflet, −@types/leaflet
```

### Dependencias entre archivos
```
route-map.element.ts
  ├── importa maplibre-gl + 'maplibre-gl/dist/maplibre-gl.css'
  ├── usa route-map.transform.ts (toGeoJSON, computeBounds)
  └── recibe points: { lat: number; lng: number }[]

route-detail.element.ts
  └── usa <route-map> y le pasa getPointsByRouteId(routeId)
```

## Comportamiento Esperado

### Escenario: Ruta con puntos GPS
- **Dado** que existe una ruta con N puntos GPS guardados en `route_points`
- **Cuando** el usuario abre el detalle de esa ruta
- **Entonces** el mapa MapLibre se renderiza con el trazado ámbar siguiendo las calles, marcador verde de inicio y marcador ámbar de fin, encuadrado automáticamente

### Escenario: Ruta sin puntos GPS
- **Dado** que una ruta no tiene puntos en `route_points`
- **Cuando** se abre su detalle
- **Entonces** el área de mapa muestra "Sin datos de GPS" y no se intenta dibujar trazado

### Escenario: Sin conexión a internet
- **Dado** que el dispositivo no tiene red
- **Cuando** se carga el mapa
- **Entonces** las teselas de OpenFreeMap no se muestran (fondo vacío), pero el trazado (fuente GeoJSON de cliente) y los marcadores se siguen dibujando sobre el fondo

### Escenario: Cambio de ruta / salida de la vista
- **Dado** que el usuario ve el detalle de una ruta
- **Cuando** vuelve al listado o abre otra ruta
- **Entonces** la instancia de mapa anterior se destruye (`map.remove()`) sin dejar fugas

## Constraints
- **Gratis y sin API key**: usar el estilo/teselas públicos de OpenFreeMap. Sin secretos en el código (cumple `docs/06-seguridad.md`).
- Coordenadas GeoJSON/MapLibre en orden `[lng, lat]`.
- MapLibre requiere relajar la CSP con `worker-src blob:`; documentarlo como cambio consciente y mínimo.
- Los tests **deben mockear `maplibre-gl`** — jsdom no soporta WebGL/canvas, igual que se mockeaba Leaflet.
- Se acepta el aumento de bundle por MapLibre (decisión de producto: precisión y experiencia de visualización priorizadas sobre tamaño). El límite de warning de bundle (200KB) puede superarse para el chunk del mapa; si ocurre, considerar carga diferida (`import()` dinámico) del componente de mapa.
- El trazado se pinta **en crudo**, sin snap-to-road ni suavizado.

## Dependencias
- `IRouteRepository.getPointsByRouteId(routeId)` — ya implementado (`sqlite-route.repository.ts`).
- `specs/features/detalle-ruta.md` — este mapa se integra en `<route-detail>`.
- **Supersede** a `specs/features/mapa-ruta-leaflet.md`.

## Notas para la implementación
- OpenFreeMap sirve las teselas vectoriales sin key. Sus estilos públicos nombrados (`liberty`, `bright`, `positron`) son claros; para el modo oscuro obligatorio se usará un **estilo oscuro sobre la fuente de teselas de OpenFreeMap**: o bien un style JSON de comunidad (tipo "dark-matter") apuntando a las teselas de OpenFreeMap, o el estilo `positron` con overrides de `paint` oscuros. Verificar en implementación los hosts exactos que pide MapLibre (estilo, glyphs, sprites, teselas) y ajustarlos en la CSP.
- MapLibre usa `[lng, lat]`; la conversión desde `{lat, lng}` vive en `route-map.transform.ts` (testeable de forma pura, sin DOM ni WebGL).
- Marcadores como elementos DOM personalizados (`maplibregl.Marker({ element })`) para poder estilarlos con tokens del sistema; el `line-color` de la capa necesita un valor literal, resuelto desde el token vía `getComputedStyle`.
- Inicializar el mapa tras insertar el contenedor en el DOM (p. ej. `requestAnimationFrame`) para que MapLibre mida bien el contenedor.
- La geometría del trazado se añade como fuente GeoJSON de cliente: se dibuja independientemente de que las teselas carguen o no.

## Fuera de alcance (features futuras)
- **Snap-to-road / map-matching / suavizado del GPS**: se decidirá tras las primeras pruebas con GPS real. Con datos sintéticos actuales no aporta.
- **Mapa offline** (teselas empaquetadas / Protomaps PMTiles): MapLibre deja el camino abierto, pero v1 es online.
- **Gráfica de velocidad** real (existe `speed` por punto), **cálculo de desnivel** real (existe `alt` por punto) y **galería de fotos**: quedan como placeholders del detalle.
