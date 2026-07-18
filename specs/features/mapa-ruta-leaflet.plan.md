# Plan de Implementación: Mapa de Ruta con Leaflet

## Paso 0 — Setup
- `pnpm add leaflet`
- `pnpm add -D @types/leaflet`
- Modificar CSP en `tauri.conf.json` para permitir tiles OSM

## Paso 1 — Test: Mapa Leaflet en route-detail (TDD RED)
- Actualizar `route-detail.element.spec.ts` con 3 nuevos tests:
  1. `<route-detail>` con puntos GPS renderiza contenedor `#map`
  2. `<route-detail>` sin puntos muestra "Sin datos de GPS"
  3. Mapa se inicializa correctamente (mock L.map)

## Paso 2 — Implementar Leaflet en route-detail (TDD GREEN)
- Modificar `route-detail.element.ts`:
  - Importar Leaflet: `import L from 'leaflet'` + `import 'leaflet/dist/leaflet.css'`
  - En `fetchAndRender()`, cargar también `getPointsByRouteId(routeId)`
  - Inicializar mapa con `L.map()` dentro de `.route-map`
  - Dibujar polyline ámbar con los puntos
  - Añadir marcadores verde (inicio) y ámbar (fin)
  - `fitBounds` con padding
  - Si no hay puntos, mostrar mensaje "Sin datos de GPS"
- Modificar `route-detail.element.css` para que `.route-map` tenga height fijo y Leaflet CSS

## Paso 3 — Modificar CSP para tiles OSM
- En `tauri.conf.json`, añadir a la CSP:
  ```
  connect-src 'self' ipc: http://ipc.localhost https://*.tile.openstreetmap.org;
  img-src 'self' data: https://*.tile.openstreetmap.org;
  ```

## Paso 4 — Tests completos + ESLint
- `pnpm test` → todos deben pasar
- `pnpm exec eslint src/ --max-warnings 0` → sin nuevos warnings

## Paso 5 — Build y verificación APK
- `pnpm tauri android build --target aarch64 --debug`
- `adb install -r .../universal/debug/app-universal-debug.apk`
- Probar en móvil: listado → detalle → mapa con trazado de ruta