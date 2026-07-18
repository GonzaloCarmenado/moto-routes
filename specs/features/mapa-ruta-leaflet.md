# Feature: Mapa de Ruta con Leaflet + OpenStreetMap

## Descripción
Reemplazar el SVG decorativo del `<route-detail>` por un mapa real interactivo usando Leaflet con tiles de OpenStreetMap. El mapa muestra el trazado de la ruta con los puntos GPS guardados en SQLite, marcador de inicio (verde) y fin (ámbar), y se centra automáticamente en los límites de la ruta.

## Criterios de Aceptación

### Dependencia
- [ ] AC-001: Se instala `leaflet` como dependencia de producción y `@types/leaflet` como devDependency.
- [ ] AC-002: Se añade `connect-src: https://*.tile.openstreetmap.org https://unpkg.com` a la CSP en `tauri.conf.json` para permitir la carga de tiles.

### Componente `<route-detail>` — Mapa Leaflet
- [ ] AC-003: El `<route-detail>` carga los puntos de la ruta (`repository.getPointsByRouteId(routeId)`) y los dibuja en un mapa Leaflet.
- [ ] AC-004: El mapa se renderiza dentro de `.route-map` como un contenedor `<div id="map">` que Leaflet usa para dibujar.
- [ ] AC-005: El trazado de la ruta se dibuja como una `L.polyline` con color `var(--amber)` y grosor 4px.
- [ ] AC-006: Se añade un marcador verde (`L.circleMarker`) en el primer punto (inicio) y un marcador ámbar en el último punto (fin).
- [ ] AC-007: El mapa se centra automáticamente usando `map.fitBounds(polyline.getBounds())` con padding de 50px.

### Sin puntos GPS
- [ ] AC-008: Si `getPointsByRouteId()` devuelve array vacío, el mapa se muestra centrado en una ubicación por defecto (España) con un mensaje "Sin datos de GPS" superpuesto.

### CSP
- [ ] AC-009: La política CSP en `tauri.conf.json` debe incluir:
  ```
  connect-src 'self' ipc: http://ipc.localhost https://*.tile.openstreetmap.org https://unpkg.com;
  img-src 'self' data: https://*.tile.openstreetmap.org;
  ```
  Esto permite cargar los tiles de OpenStreetMap y el CSS/JS de Leaflet desde unpkg.

### Estilo
- [ ] AC-010: El contenedor `.route-map` mantiene `height: 200px` y `border-radius: var(--r-md)`.
- [ ] AC-011: Los estilos de Leaflet se importan desde `node_modules/leaflet/dist/leaflet.css` (vía import en el .css del componente o en el .ts).

### Tests
- [ ] AC-012: Test unitario: `<route-detail>` con puntos GPS renderiza un contenedor de mapa con id 'map'.
- [ ] AC-013: Test unitario: `<route-detail>` sin puntos muestra "Sin datos de GPS".
- [ ] AC-014: Test unitario: el mapa se inicializa con `L.map()` (se puede mockear Leaflet).

## Comportamiento Esperado

### Escenario: Ruta con puntos GPS
- **Dado** que existe una ruta con 100 puntos GPS guardados
- **Cuando** se abre el detalle de esa ruta
- **Entonces** el mapa Leaflet se renderiza con el trazado en ámbar, marcador verde de inicio y marcador ámbar de fin, centrado automáticamente

### Escenario: Ruta sin puntos GPS (simulación antigua)
- **Dado** que existe una ruta guardada con `simulateRecording` (genera puntos)
- **Cuando** se abre el detalle
- **Entonces** los puntos se dibujan igual que en una ruta real (Leaflet no distingue origen)

### Escenario: Fallo de red al cargar tiles
- **Dado** que el dispositivo no tiene conexión a internet
- **Cuando** se carga el mapa
- **Entonces** los tiles no se muestran (fondo gris), pero el trazado polyline se sigue viendo sobre el fondo gris (Leaflet dibuja vectores independientemente de los tiles)

## Notas para la implementación
- Leaflet se importa como módulo ES: `import L from 'leaflet'`
- Los estilos de Leaflet se importan con: `import 'leaflet/dist/leaflet.css'`
- Para evitar problemas con imágenes de marcadores por defecto de Leaflet, se usan `L.circleMarker` en lugar de `L.marker` (no requieren assets).
- El mapa se destruye con `.remove()` al cambiar de vista (para evitar fugas de memoria).
- La latencia de carga de tiles es normal; Leaflet muestra el mapa progresivamente.
- Se puede añadir un spinner de carga mientras se inicializa el mapa en una mejora futura.