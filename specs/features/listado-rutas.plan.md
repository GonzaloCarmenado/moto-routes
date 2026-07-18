# Plan de Implementación: Listado de Rutas

## Paso 1 — Test: Componente `<route-list>` (TDD)
- Escribir `route-list.element.spec.ts` con tests:
  1. `<route-list>` con repositorio vacío muestra "No hay rutas guardadas todavía"
  2. `<route-list>` con 2 rutas renderiza 2 tarjetas `.route-card`
  3. Subtítulo "2 rutas guardadas · X km recorridos" calculado correctamente
  4. Cada tarjeta contiene `.thumb`, `.name`, `.date`, `.badge.distance`, `.badge.duration`
- Tests deben ser async (usar `await waitRender()`)

## Paso 2 — Implementar `<route-list>`
- Crear `src/routes/route-list.element.ts` (Web Component)
- Crear `src/routes/route-list.element.css` (estilos con tokens)
- Recibe `repository: IRouteRepository` como propiedad
- En `connectedCallback()`:
  - Llama a `repository.getAll()`
  - Calcula subtítulo (count + km totales)
  - Renderiza tarjetas o mensaje vacío
- Formateo de fecha: `Date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })`
- Formateo de duración: importar `formatDuration` de `cockpit.transform.ts`
- Formateo de distancia: redondear a 1 decimal con " km"

## Paso 3 — Modificar `<nav-bar>` para evento `nav-rutas`
- Añadir event listener en `buildRutasBtn()` que dispare CustomEvent `nav-rutas`
- Añadir handler `handleRutasClick()` similar a `handleGrabarClick()`

## Paso 4 — Modificar `<app-root>` para vista de rutas
- Añadir vista `'routes'` al tipo `ViewName`
- Escuchar evento `nav-rutas` y llamar a `navigateTo('routes')`
- En `render()`, cuando `currentView === 'routes'`, crear `<route-list>` y pasarle el repositorio
- El repositorio se inicializa en `connectedCallback()` (misma lógica que cockpit: SQLite o Memory)

## Paso 5 — Pasar repositorio desde app-root a los componentes
- Mover la inicialización del repositorio de `cockpit-view` a `app-root`
- `<cockpit-view>` ya no instancia su propio repositorio, lo recibe como propiedad
- `<route-list>` recibe el mismo repositorio
- Refactor: `app-root` se convierte en el dueño de la instancia `IRouteRepository`

## Paso 6 — Tests completos
- Ejecutar `pnpm test` → todos los tests deben pasar
- Ejecutar `pnpm exec eslint src/ --max-warnings 0` → corregir nuevos warnings

## Paso 7 — Build y verificación APK
- `pnpm tauri android build --target aarch64 --debug`
- `adb install -r .../universal/debug/app-universal-debug.apk`
- Verificar en móvil: navegar Rutas ↔ Grabar, ver listado con datos de simulación