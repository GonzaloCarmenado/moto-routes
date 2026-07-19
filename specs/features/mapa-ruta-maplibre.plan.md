# Plan de Implementación: Visualización de Ruta en Mapa (MapLibre + OpenFreeMap)

Basado en `specs/features/mapa-ruta-maplibre.md`. TDD estricto: test primero (RED) → implementación mínima (GREEN) → refactor. Cada paso es atómico y completable en una sesión.

## Resumen de Tareas
| # | Tarea | Issue | Archivos | AC cubiertos | Complejidad |
|---|-------|-------|----------|--------------|-------------|
| 0 | Setup deps + CSP | [#24](https://github.com/GonzaloCarmenado/moto-routes/issues/24) | `package.json`, `tauri.conf.json`, `index.html` | AC-001, AC-002 | Small |
| 1 | Test transform (RED) | [#25](https://github.com/GonzaloCarmenado/moto-routes/issues/25) | `route-map.transform.spec.ts` | AC-009 | Small |
| 2 | Test `<route-map>` (RED) | [#26](https://github.com/GonzaloCarmenado/moto-routes/issues/26) | `route-map.element.spec.ts` | AC-016, AC-017, AC-018 | Medium |
| 3 | Implementar transform (GREEN) | [#27](https://github.com/GonzaloCarmenado/moto-routes/issues/27) | `route-map.transform.ts` | AC-009 | Small |
| 4 | Implementar `<route-map>` (GREEN) | [#28](https://github.com/GonzaloCarmenado/moto-routes/issues/28) | `route-map.element.ts` + `.css` | AC-003…AC-013 | Medium |
| 5 | Test integración detalle (RED) | [#29](https://github.com/GonzaloCarmenado/moto-routes/issues/29) | `route-detail.element.spec.ts` | AC-019 | Small |
| 6 | Integrar en `<route-detail>` (GREEN) | [#30](https://github.com/GonzaloCarmenado/moto-routes/issues/30) | `route-detail.element.ts` + `.css` | AC-014, AC-015 | Small |
| 7 | Suite completa + ESLint | [#31](https://github.com/GonzaloCarmenado/moto-routes/issues/31) | — | todos | Small |
| 8 | Build APK + verificación en móvil | [#32](https://github.com/GonzaloCarmenado/moto-routes/issues/32) | — | todos | Small |

---

## Paso 0 — Setup: dependencias y CSP · [#24](https://github.com/GonzaloCarmenado/moto-routes/issues/24)
- `pnpm add maplibre-gl`
- `pnpm remove leaflet @types/leaflet`
- Actualizar CSP en `src-tauri/tauri.conf.json`:
  - `connect-src`: quitar `https://*.tile.openstreetmap.org`, añadir `https://tiles.openfreemap.org`
  - `img-src`: `'self' data: blob: https://tiles.openfreemap.org`
  - añadir `worker-src 'self' blob:`
- Replicar la misma CSP en el `<meta http-equiv="Content-Security-Policy">` de `index.html` (hoy no tenía los dominios del mapa; debe quedar equivalente para que también funcione en `pnpm dev`).
- **Cubre**: AC-001, AC-002

## Paso 1 — Test: `route-map.transform.ts` (TDD RED) · [#25](https://github.com/GonzaloCarmenado/moto-routes/issues/25)
- Crear `src/shared/route-map/route-map.transform.spec.ts`:
  1. `toGeoJSON(points)` devuelve un `LineString` con coordenadas en orden `[lng, lat]` (verificar que invierte lat/lng)
  2. `toGeoJSON([])` / entrada vacía se maneja sin romper
  3. `computeBounds(points)` devuelve el bounding box correcto (min/max lng/lat) para varios puntos
- Tests puros, sin DOM ni MapLibre.
- **Cubre**: AC-009

## Paso 2 — Test: `<route-map>` (TDD RED) · [#26](https://github.com/GonzaloCarmenado/moto-routes/issues/26)
- Crear `src/shared/route-map/route-map.element.spec.ts` con `maplibre-gl` **mockeado** (`vi.mock('maplibre-gl', …)` con `Map`, `Marker`, `LngLatBounds` fake):
  1. Con puntos → se instancia `maplibregl.Map` y se registra la fuente/capa del trazado
  2. Sin puntos (`points = []`) → muestra "Sin datos de GPS" y **no** instancia `Map`
  3. Al quitar el elemento del DOM (`disconnectedCallback`) → llama a `map.remove()`
- **Cubre**: AC-016, AC-017, AC-018

## Paso 3 — Implementar `route-map.transform.ts` (TDD GREEN) · [#27](https://github.com/GonzaloCarmenado/moto-routes/issues/27)
- `toGeoJSON(points: {lat;lng}[]): GeoJSON.Feature<LineString>` → `coordinates` en `[lng, lat]`
- `computeBounds(points): [[minLng,minLat],[maxLng,maxLat]]`
- Sin dependencias de DOM/WebGL.
- **Cubre**: AC-009

## Paso 4 — Implementar `<route-map>` + CSS (TDD GREEN) · [#28](https://github.com/GonzaloCarmenado/moto-routes/issues/28)
- Crear `src/shared/route-map/route-map.element.ts`:
  - `import maplibregl from 'maplibre-gl'` + `import 'maplibre-gl/dist/maplibre-gl.css'`
  - Propiedad `points`; setter (re)renderiza y destruye mapa previo
  - Contenedor con `data-cy="route-map-container"`
  - Init tras insertar en DOM (`requestAnimationFrame`) con estilo **oscuro** de OpenFreeMap
  - Añadir fuente GeoJSON (via `route-map.transform`) + capa de línea ámbar (grosor 4); color resuelto desde `--amber` con `getComputedStyle`
  - Marcadores DOM inicio (verde) y fin (ámbar) como `maplibregl.Marker({ element })`
  - `fitBounds(computeBounds(points), { padding: 50 })`
  - Estado vacío "Sin datos de GPS"
  - `disconnectedCallback` → `map.remove()`
- Crear `src/shared/route-map/route-map.element.css` (importa `tokens.css`, `.route-map` con `--r-md`, altura fija, estilos de markers y estado vacío)
- **Cubre**: AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-010, AC-011, AC-012, AC-013

## Paso 5 — Test: integración en `<route-detail>` (TDD RED) · [#29](https://github.com/GonzaloCarmenado/moto-routes/issues/29)
- Añadir test a `src/routes/route-detail.element.spec.ts`:
  1. Con una ruta y puntos, el detalle renderiza un `<route-map>` y le transfiere los puntos cargados (`getPointsByRouteId`)
- Actualizar/eliminar los tests antiguos que asumían el `#map` de Leaflet.
- **Cubre**: AC-019

## Paso 6 — Integrar en `<route-detail>` (TDD GREEN) · [#30](https://github.com/GonzaloCarmenado/moto-routes/issues/30)
- Modificar `src/routes/route-detail.element.ts`:
  - Importar el elemento `<route-map>` (para que quede definido) y quitar `import L from 'leaflet'` + `buildMap` Leaflet
  - Crear `<route-map>` y asignarle `points`
- Ajustar `src/routes/route-detail.element.css` (contenedor del mapa)
- Verificar que stats, botón Volver y placeholders siguen igual.
- **Cubre**: AC-014, AC-015

## Paso 7 — Suite completa + ESLint · [#31](https://github.com/GonzaloCarmenado/moto-routes/issues/31)
- `pnpm test` → 100% pass, cobertura ≥ 80%, todos los AC con al menos un test
- `pnpm exec eslint src/ --max-warnings 0` → sin warnings (vigilar `max-lines`/`max-lines-per-function`: si `route-map.element.ts` crece, extraer helpers a `route-map.transform.ts`)
- `pnpm build` → `tsc` + `vite build` sin errores (vigilar aviso de bundle por MapLibre; si molesta, `import()` dinámico del componente)

## Paso 8 — Build APK + verificación en móvil · [#32](https://github.com/GonzaloCarmenado/moto-routes/issues/32)
- `pnpm tauri android build --target aarch64 --debug`
- `adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
- Probar en móvil: listado → detalle → mapa oscuro con trazado de la ruta sobre las calles, marcadores inicio/fin, encuadre correcto; y una ruta sin puntos → "Sin datos de GPS"

---

## Notas
- Al cerrar el feature, registrar en `memory/decisions.md` un ADR: "MapLibre GL + OpenFreeMap sustituye a Leaflet + OSM" (motivo: vector nítido, gratis sin key, camino a offline vía PMTiles; supersede la decisión implícita de Leaflet). Actualizar `memory/context.md` (estado del feature) — se hace en fase REVIEW/TEST, no antes.
- Snap-to-road / suavizado quedan fuera; se reevalúan tras las pruebas con GPS real.
