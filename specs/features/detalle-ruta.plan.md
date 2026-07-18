# Plan de Implementación: Detalle de Ruta

## Paso 1 — Test: Componente `<route-detail>` (TDD RED)
- Escribir `route-detail.element.spec.ts` con 3 tests:
  1. `<route-detail>` con ruta inexistente muestra "Ruta no encontrada"
  2. `<route-detail>` con ruta existente muestra título, nombre, fecha, 4 stat-tiles y sección mapa
  3. `<route-detail>` emite evento `back-to-list` al pulsar "← Volver"
- Tests deben ser async (usar `waitRender()`)

## Paso 2 — Test: Evento `view-route` desde `<route-list>` (TDD RED)
- Añadir 1 test a `route-list.element.spec.ts`:
  1. Al hacer click en una tarjeta, se emite evento `view-route` en `window` con `detail: { routeId }`

## Paso 3 — Implementar `<route-detail>` (TDD GREEN)
- Crear `src/routes/route-detail.element.ts`
- Crear `src/routes/route-detail.element.css`
- Recibe `repository: IRouteRepository` y `routeId: string`
- Renderiza: mapa SVG placeholder → 4 stat-tiles → gráfica placeholder → fotos placeholder → notas
- Botón "← Volver" con evento `back-to-list` por window

## Paso 4 — Modificar `<route-list>` para evento `view-route`
- Añadir click listener en `.buildCard()` que emita `window.dispatchEvent(new CustomEvent('view-route', { detail: { routeId } }))`

## Paso 5 — Modificar `<app-root>` para vista `detail`
- Añadir `<route-detail>` a `buildUI()` (todos los componentes se crean una vez, se muestran/ocultan)
- Escuchar eventos `view-route` y `back-to-list` en `window`
- Mostrar/ocultar las vistas correspondientes

## Paso 6 — Tests completos
- `pnpm test` → todos deben pasar
- `pnpm exec eslint src/ --max-warnings 0` → sin nuevos warnings

## Paso 7 — Build y verificación APK
- `pnpm tauri android build --target aarch64 --debug`
- `adb install -r .../universal/debug/app-universal-debug.apk`
- Probar en móvil: listado → detalle → volver