# Plan de Implementación: Mejoras Técnicas

> Refactor sin cambio de comportamiento. Regla transversal en **todos** los pasos: la suite de tests existente sigue en verde sin tocar sus aserciones (solo imports o tests nuevos para código extraído), y las quality gates se mantienen (ESLint 0 warnings, cobertura ≥ 80%, Clippy/rustfmt/cargo test limpios).

## Resumen de Tareas
| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Helper `renderShadow` en `BaseElement` | `shared/base-element.ts` (+spec) | AC-006 | Small |
| 2 | Migrar componentes `HTMLElement` → `BaseElement` | app/nav-bar/route-detail/route-list/route-map | AC-001, AC-006 | Medium |
| 3 | Módulo central de eventos de navegación | `shared/app-events.ts` (+spec) + emisores/oyentes | AC-002 | Medium |
| 4 | Resolver `dom.ts` (adoptar o eliminar) | `shared/utils/dom.ts` | AC-003 | Small |
| 5 | Servicio de foto unificado | `shared/services/photo-persist.service.ts` (+spec), cockpit/route-detail | AC-007 | Medium |
| 6 | CSS inline → `.css` + colores por token | toast, route-detail, route-map-photos, tokens.css | AC-004, AC-005 | Medium |

Orden por dependencias: 1 antes de 2 (la migración usa el helper). 3, 4 y 5 son independientes entre sí. 6 va al final porque es el más amplio y toca `toast.ts`, que la spec de usabilidad moverá después a `shared/feedback/` (coordinar para no reescribirlo dos veces).

---

## Paso 1: Helper `renderShadow` en `BaseElement`
- **Objetivo**: Extraer el patrón repetido de montaje de Shadow DOM (`<style>` + `root.innerHTML = ''` + `appendChild`) a un método reutilizable, para que la migración del Paso 2 aporte valor real y no sea un cambio de nombre.
- **AC cubiertos**: AC-006
- **Tests a escribir** (primero):
  - Test: `renderShadow(styles, node)` inyecta un `<style>` con el CSS y monta los nodos en el shadow root → valida AC-006
  - Test: llamar a `renderShadow` dos veces resetea el contenido previo (no acumula) → valida el reset in-place
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/base-element.ts` (añadir `protected renderShadow(styles: string, ...nodes: Node[]): void`, sin forzar `attachShadow` a quien no lo tenga: si no hay `shadowRoot`, no-op o error controlado)
  - `CREAR src/shared/base-element.spec.ts`
- **Notas**: No cambiar la firma de `emit` ni de `render`. El helper es aditivo; nadie lo usa todavía tras este paso (lo adoptan en el Paso 2).

## Paso 2: Migrar componentes `HTMLElement` → `BaseElement`
- **Objetivo**: Unificar la clase base de todos los custom elements.
- **AC cubiertos**: AC-001 (y aplica AC-006 al adoptar `renderShadow` donde encaje)
- **Tests a escribir**: Ninguno nuevo de comportamiento — los tests existentes de cada componente (`route-detail.element.spec.ts`, `route-list.element.spec.ts`, `route-map.element.spec.ts`, `nav-bar.element.spec.ts`) deben seguir pasando sin cambiar aserciones. Ajustar solo imports si hiciera falta.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/app/app.element.ts` (`AppRoot extends BaseElement`; `render()` abstracto — implementar aunque sea con el `buildUI` actual)
  - `MODIFICAR src/components/nav-bar/nav-bar.element.ts`
  - `MODIFICAR src/routes/route-detail.element.ts`
  - `MODIFICAR src/routes/route-list.element.ts`
  - `MODIFICAR src/shared/route-map/route-map.element.ts`
- **Notas**: `BaseElement` declara `protected abstract render(): void`. Los que hoy no tienen `render` (p. ej. `app-root` usa `buildUI`) deben implementarlo o renombrar. Preservar todos los `data-cy` y el `attachShadow` propio de cada uno. `app-root` y `nav-bar` no usan shadow DOM del mismo modo — comprobar caso por caso antes de forzar `renderShadow`.

## Paso 3: Módulo central de eventos de navegación
- **Objetivo**: Eliminar los strings literales de eventos dispersos y tiparlos en un único sitio.
- **AC cubiertos**: AC-002
- **Tests a escribir** (primero):
  - Test: `dispatchAppEvent(APP_EVENTS.VIEW_ROUTE, { routeId })` despacha un `CustomEvent` con el nombre y `detail` correctos → valida AC-002
- **Archivos a crear/modificar**:
  - `CREAR src/shared/app-events.ts` (constantes `APP_EVENTS.{NAV_GRABAR, NAV_RUTAS, VIEW_ROUTE, BACK_TO_LIST}`, tipos de `detail`, y helper `dispatchAppEvent`)
  - `CREAR src/shared/app-events.spec.ts`
  - `MODIFICAR src/app/app.element.ts`, `src/components/nav-bar/nav-bar.element.ts`, `src/routes/route-list.element.ts`, `src/routes/route-detail.element.ts` (importar constantes en `addEventListener`/`removeEventListener`/dispatch)
- **Notas**: Mantener los mismos nombres de evento string ("nav-grabar", etc.) como valor de las constantes para no romper nada. Los `data-cy` de los botones de nav (que coinciden con nombres de evento) no se tocan.

## Paso 4: Resolver `dom.ts`
- **Objetivo**: No dejar código muerto en `shared/utils`.
- **AC cubiertos**: AC-003
- **Tests a escribir**: Si se adopta `createElement`, test unitario del helper; si se elimina, ninguno (y se borra cualquier referencia/tipo).
- **Archivos a crear/modificar**:
  - `MODIFICAR o ELIMINAR src/shared/utils/dom.ts`
  - Si se elimina: quitar la exclusión de `dom.ts` en `vitest.config.ts`
- **Notas**: Decisión recomendada: **eliminar** `createElement` de `dom.ts` (nadie lo usa y su firma `Object.assign(el, props)` no encaja bien con el estilo actual de construcción por `className`/`textContent`). Si en el Paso 6 surge necesidad real de un helper, se añade uno acorde. Verificar con `grep` que no hay ningún import antes de borrar.

## Paso 5: Servicio de foto unificado
- **Objetivo**: Deduplicar la lógica "validar → geolocalizar → guardar archivo → construir `CreatePhoto` → persistir".
- **AC cubiertos**: AC-007
- **Tests a escribir** (primero):
  - Test: el servicio unificado valida, geolocaliza con la estrategia de fallback dada y persiste con los metadatos correctos (routeId, filePath, lat/lon, capturedAt) → valida AC-007
  - Los tests existentes `cockpit-photo.service.spec.ts` y `route-detail-photo.service.spec.ts` siguen pasando (adaptando solo si cambia la superficie interna, no el comportamiento)
- **Archivos a crear/modificar**:
  - `CREAR src/shared/services/photo-persist.service.ts` (núcleo compartido)
  - `CREAR src/shared/services/photo-persist.service.spec.ts`
  - `MODIFICAR src/cockpit/cockpit-photo.service.ts` (delega en el servicio compartido; conserva su firma pública con callbacks `onSuccess/onError/onCancel`)
  - `MODIFICAR src/routes/route-detail-photo.service.ts` (delega en el servicio compartido; conserva su firma `addPhotoToRoute`)
- **Notas**: La diferencia entre ambos flujos es la estrategia de ubicación de fallback (cockpit: último punto de la ruta activa; detalle: centroide de la ruta) y cómo notifican (callbacks vs return). El servicio compartido recibe esos parámetros. Preservar la desviación documentada de centroide de [[fotos-ruta]] AC-013 — no cambiarla.

## Paso 6: CSS inline → `.css` + colores por token
- **Objetivo**: Cumplir la prohibición de CSS inline y de literales de color de CLAUDE.md.
- **AC cubiertos**: AC-004, AC-005
- **Tests a escribir**: Ninguno nuevo de comportamiento; los tests de apertura/cierre del visor y de render de galería/toast siguen pasando. Verificación por `grep` (sin `cssText` de estilos estáticos ni literales de color) y revisión.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/utils/toast.ts` (mover el bloque `cssText` a una hoja/clase; sustituir `#d64545`/`#e8a838`/rgba por `--danger`/`--amber`/`--amber-soft`). Coordinar con la spec de usabilidad, que después moverá este archivo a `shared/feedback/`.
  - `MODIFICAR src/routes/route-detail.element.ts` + `src/routes/route-detail.element.css` (visor/lightbox, miniaturas, contador → clases con tokens; sustituir `#888`, `rgba(0,0,0,0.95)`)
  - `MODIFICAR src/shared/route-map/route-map-photos.ts` + hoja del mapa (marcadores → clases; sustituir `#B8653A`→`--rust-line`, `#fff`→token de contraste)
  - `MODIFICAR src/shared/styles/tokens.css` si falta algún token (p. ej. scrim de overlay, blanco de contraste)
- **Notas**: Solo se permite `element.style` para valores dinámicos (posición calculada del menú de foto, `strokeDasharray` del arco, toggles de `display`) — cada uno con comentario justificándolo. Este paso es el más amplio; si conviene, dividir la implementación por componente pero mantener el paso conceptual.

---

## Verificación final (tras completar todos los pasos)
- `pnpm lint` → 0 warnings/errores
- `pnpm test:coverage` → 100% pass, cobertura ≥ 80%
- `pnpm build` → sin errores
- `pnpm rust:format` / `rust:lint` / `rust:test` → limpios (no debería haber cambios en Rust en esta spec)
- Ejecutar `review-agent` sobre `mejoras-tecnicas` (sección CRÍTICO obligatoria por tocar `shared/`)
