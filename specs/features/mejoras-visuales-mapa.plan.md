# Plan de Implementación: Mejoras Visuales y de Interacción del Mapa (`<route-map>`)

## Advertencias previas (no bloqueantes, no requieren ADR)

- **AC-002 / AC-012 (ratio de contraste 3:1)**: no son verificables con precisión numérica en los tests unitarios propuestos (Vitest + `maplibre-gl` mockeado no conoce los colores reales del estilo `dark` de OpenFreeMap ni renderiza WebGL). Los tests de este plan cubren el mecanismo (`setPaintProperty` se llama con un color de la paleta, distinto del original; las clases CSS de los marcadores resuelven `--success`/`--amber`) — la verificación del ratio 3:1 real queda como **verificación visual manual** (mismo patrón ya usado en el proyecto para AC-007/AC-003 de `deuda-tecnica-auditoria`). Se incluye explícitamente en el Paso 7.
- **Layer IDs reales del estilo `dark` de OpenFreeMap**: la spec ya señala (Notas de Implementación) que hay que inspeccionar el style JSON público en tiempo de implementación. Este plan no fija nombres de capa reales — usa un placeholder (`ROAD_LAYER_IDS`) que el impl-agent debe rellenar tras inspeccionar `https://tiles.openfreemap.org/styles/dark`, documentando los IDs encontrados como comentario (tal como pide AC-003/Notas de Implementación de la spec).
- **Riesgo de tamaño de archivo (ESLint `max-lines: 300`, `max-lines-per-function: 60`)**: `route-map.element.ts` ya tiene ~200 líneas antes de esta spec. Sumar skeleton + atribución + contraste + marcadores + zoom + fullscreen en el mismo archivo lo llevaría a superar el límite. Este plan sigue el precedente que **ya existe en el propio componente** (`route-map-photos.ts`, extraído de `route-map.element.ts` para la lógica de marcadores/clustering de fotos) y propone extraer dos módulos nuevos de responsabilidad única: `route-map-contrast.ts` (Paso 3) y `route-map-fullscreen.ts` (Paso 6). `route-map.element.ts` queda como orquestador (igual que ya hace con `route-map-photos.ts`), no como el lugar donde vive toda la lógica nueva.
- **No se detecta ningún gap de spec ni decisión de arquitectura pendiente** que requiera un ADR nuevo antes de planificar — el componente, el stack (MapLibre, tokens, Shadow DOM) y las convenciones ya están decididos y documentados.

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|--------------|
| 1 | Skeleton de carga + refactor del mock de `load` en tests | `route-map.element.ts`, `route-map.element.css`, `route-map.element.css.spec.ts` (nuevo), `route-map.element.spec.ts` | AC-005, AC-006, AC-007, AC-023 | Medium |
| 2 | Atribución OpenFreeMap/OSM discreta | `route-map.element.ts`, `route-map.element.css`, `route-map.element.css.spec.ts`, `route-map.element.spec.ts` | AC-008, AC-009 (parcial), AC-024 | Small |
| 3 | Contraste visual de capas de carretera (`setPaintProperty`) | `route-map-contrast.ts` (nuevo), `route-map-contrast.spec.ts` (nuevo), `route-map.element.ts`, `route-map.element.spec.ts` | AC-001, AC-002 (parcial), AC-003, AC-004, AC-022 | Medium |
| 4 | Marcadores de inicio/fin como icono (pin/bandera) | `route-map.element.ts`, `route-map.element.css`, `route-map.element.css.spec.ts`, `route-map.element.spec.ts` | AC-010, AC-011, AC-012 (parcial), AC-025 | Small |
| 5 | Controles de zoom (`NavigationControl`, hitbox 56×56) | `route-map.element.ts`, `route-map.element.css`, `route-map.element.css.spec.ts`, `route-map.element.spec.ts` | AC-013, AC-014, AC-015 (parcial), AC-026 | Small |
| 6 | Botón de pantalla completa (Fullscreen API real) | `route-map-fullscreen.ts` (nuevo), `route-map-fullscreen.spec.ts` (nuevo), `route-map.element.ts`, `route-map.element.css`, `route-map.element.css.spec.ts`, `route-map.element.spec.ts` | AC-016, AC-017, AC-018, AC-019, AC-020, AC-021, AC-027, AC-028, AC-029 | Large |
| 7 | Regresión completa + cierre de verificaciones manuales | (sin código nuevo — ejecución de suite + checklist manual) | AC-002, AC-009, AC-012, AC-015, AC-020 (dispositivo real) | Small |

---

## Paso 1: Skeleton de carga del mapa [x]

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/54
- **Objetivo**: Mostrar un placeholder visual sobre `--panel-sunken` mientras el mapa no ha disparado `load`, y sustituirlo sin solapamiento en cuanto se dispara. De paso, se cambia el mock compartido de `maplibregl.Map.on('load', ...)` en el spec — hoy invoca el callback de forma **síncrona e incondicional** al registrarlo, lo que hace imposible testear ningún estado "antes de `load`". Este cambio de infraestructura de test es prerrequisito de este paso y de los pasos 3 y 6 (que también dependen del evento `load`).
- **AC cubiertos**: AC-005, AC-006, AC-007, AC-023
- **Tests a escribir** (en `src/shared/route-map/route-map.element.spec.ts`):
  - Refactor de mock (no es un test nuevo, pero debe hacerse primero — RED en el resto de tests hasta completarlo): sustituir `onFn = vi.fn((event, cb) => { if (event === 'load') cb(); })` por una versión que **solo registra** el callback (sin invocarlo), añadiendo un helper `triggerLoad()` análogo al ya existente `triggerZoomEnd()`. Para no reescribir todos los tests actuales que asumen `load` inmediato, `mountRouteMap()` pasa a invocar `triggerLoad()` justo después de `waitRender()` — el comportamiento por defecto de los tests existentes no cambia. Se añade una nueva función `mountRouteMapWithoutLoad()` (mismo cuerpo que `mountRouteMap()` pero sin disparar `triggerLoad()`) solo para el test de skeleton.
  - Test: "shows the loading skeleton while `load` has not fired yet, and hides it once `load` fires" (usa `mountRouteMapWithoutLoad`, comprueba que existe un elemento con `data-cy="route-map-skeleton"` visible; llama a `triggerLoad()`, espera `waitRender()`, comprueba que el elemento ya no está presente o queda oculto) → Valida AC-005, AC-006, AC-023.
  - Test (regresión): confirmar que los tests ya existentes (que dependen de `load` inmediato vía `mountRouteMap()`) siguen en verde tras el refactor del mock, sin tocar su cuerpo.
  - Nuevo archivo `src/shared/route-map/route-map.element.css.spec.ts` (mismo patrón que `photo-capture.element.css.spec.ts`):
    - Test: "the skeleton shimmer animation relies on the global reduced-motion override (no exemption of its own)" → comprueba que el CSS resuelto contiene `@media (prefers-reduced-motion: reduce)` y `animation-duration: 0.01ms !important` (heredado de `tokens.css` vía `@import`), y que `.route-map-skeleton` usa `animation:` (no una animación controlada por JS) → Valida AC-007.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: en `render()`, cuando `points.length > 0`, crear un `div.route-map-skeleton` (`data-cy="route-map-skeleton"`) y añadirlo al `container` antes/superpuesto a `mapRoot`; en `initMap()`, dentro del handler de `'load'`, quitar el skeleton del DOM **antes** de `drawRoute`/`renderPhotoMarkers` (evita el solapamiento de AC-006).
  - `MODIFICAR src/shared/route-map/route-map.element.css`: nueva clase `.route-map-skeleton` — `position: absolute; inset: 0; background: var(--panel-sunken);`, patrón de franjas diagonales (reutilizando el lenguaje visual de `.media-placeholder` de `specs/ui/design-system.md` §7) + `@keyframes` de shimmer aplicado vía `animation:` (sin `@media` propio — se apoya en el override global de `tokens.css`, ya importado en este mismo archivo).
  - `CREAR src/shared/route-map/route-map.element.css.spec.ts` (nuevo archivo, primer test de CSS resuelto de este componente).
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`: refactor del mock de `on('load', ...)` + nuevos helpers + nuevo test.
- **Notas**: El z-index del skeleton debe quedar por encima de `.maplibre-root` mientras el mapa "invisible" carga tiles detrás — no hace falta ocultar `mapRoot`, basta con que el skeleton lo tape visualmente hasta que se elimine.

## Paso 2: Atribución OpenFreeMap / OpenStreetMap [x]

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/55
- **Objetivo**: Revertir `attributionControl: false` a un control de atribución real y discreto, cumpliendo la licencia de OpenFreeMap/OSM.
- **AC cubiertos**: AC-008, AC-009 (parcial — ver Paso 7 para la verificación de no-solape final una vez existan zoom/fullscreen), AC-024
- **Tests a escribir** (en `route-map.element.spec.ts`):
  - Test: "constructs the map with a real (compact) attribution control instead of `false`" → `expect(mapCtor.mock.calls[0]?.[0].attributionControl).not.toBe(false)` y comprobación del valor exacto elegido en implementación (p. ej. `{ compact: true }`) → Valida AC-024, AC-008.
  - En `route-map.element.css.spec.ts`:
    - Test: "overrides MapLibre's attribution control to a discreet, small style coherent with the design system" → comprueba que el CSS resuelto contiene una regla dirigida a la clase de atribución de MapLibre (p. ej. `.maplibregl-ctrl-attrib`) con una declaración de tamaño de fuente reducido/discreto → Valida AC-009 (parcial: estilo discreto; el no-solape con zoom/fullscreen se revisa en el Paso 7 cuando esos controles ya existen).
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: cambiar `attributionControl: false` por `attributionControl: { compact: true }` en la construcción de `maplibregl.Map`.
  - `MODIFICAR src/shared/route-map/route-map.element.css`: override de `.maplibregl-ctrl-attrib` (la hoja de MapLibre se concatena antes que la propia — `sheet = maplibreStyles + styles` — así que la cascada ya favorece nuestras reglas) para reducir tamaño de fuente/opacidad, sin tocar su posición por defecto (esquina inferior).
  - `MODIFICAR src/shared/route-map/route-map.element.css.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`.
- **Notas**: Verificar en implementación el nombre de clase exacto que usa la versión de `maplibre-gl` instalada para el control de atribución (`.maplibregl-ctrl-attrib` es el nombre histórico, pero conviene confirmarlo contra `node_modules/maplibre-gl/dist/maplibre-gl.css`, ya importado en este mismo componente).

## Paso 3: Contraste visual de las capas de carretera [x]

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/56
- **Objetivo**: Tras `load`, aplicar overrides de `paint` sobre las capas de carretera del estilo `dark`, con colores de la paleta "Asfalto Nocturno", sin lanzar excepciones si alguna capa no existe.
- **AC cubiertos**: AC-001, AC-002 (parcial — ver advertencia inicial), AC-003, AC-004, AC-022
- **Tests a escribir**:
  - Nuevo archivo `src/shared/route-map/route-map-contrast.spec.ts` (función pura, sin mocks de DOM/MapLibre):
    - Test: "builds one paint override per known road layer id, using the given color" → `buildRoadContrastOverrides(color)` devuelve un array de `{ layerId, property, value }` con `value === color` para cada id en `ROAD_LAYER_IDS` → Valida AC-001 (estructura de los overrides).
    - Test: "the suggested colors are warm/neutral tones, not cold blues" (test de guarda simple: el color de entrada usado en el test no es una cadena `blue`/`azure` — más una comprobación de que la función no impone ningún color propio, ya que el color lo decide `route-map.element.ts` vía `resolveToken`) → Valida AC-004 (a nivel de mecanismo; el token concreto elegido se documenta como comentario en el código).
  - En `route-map.element.spec.ts`:
    - Extender el mock compartido: añadir `setPaintProperty: vi.fn()` a `mockMapInstance` (exportado y reseteado en `beforeEach`, igual que el resto de métodos).
    - Test: "calls `setPaintProperty` for at least one road layer after `load`, with a color different from a placeholder/blue tone" (usa `mountRouteMap` — que ya dispara `load` por defecto tras el Paso 1 — y comprueba `setPaintProperty.mock.calls.length > 0` y que el color aplicado no es el `AMBER_FALLBACK`/azul) → Valida AC-001, AC-002 (mecanismo), AC-022.
    - Test: "does not throw and still draws the route, markers and fitBounds when `setPaintProperty` throws for a given layer id" (mock de `setPaintProperty` que lanza para el primer `layerId`, o para todos) → comprobar que `addSource`/`addLayer`/`fitBounds`/`markerCtor` se siguen llamando con normalidad, sin que el test falle por una excepción no controlada → Valida AC-003.
- **Archivos a crear/modificar**:
  - `CREAR src/shared/route-map/route-map-contrast.ts`: exporta `ROAD_LAYER_IDS` (constante documentada con comentario — placeholder a rellenar tras inspeccionar el style JSON real de `https://tiles.openfreemap.org/styles/dark`, ver advertencia inicial) y `buildRoadContrastOverrides(color: string): { layerId: string; property: string; value: string }[]` (función pura).
  - `CREAR src/shared/route-map/route-map-contrast.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: nuevo método privado `applyContrastOverrides(map)`, llamado dentro de `map.on('load', ...)` (antes o junto a `drawRoute`); resuelve el color con `resolveToken` (reutilizando el helper ya existente) y, por cada override de `buildRoadContrastOverrides(color)`, llama a `map.setPaintProperty(layerId, property, value)` envuelto en un `try/catch` individual (AC-003 — un fallo en una capa no debe abortar el resto ni el resto del ciclo de vida del mapa).
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`.
- **Notas**: Elegir un token ya existente y coherente con la paleta para el color de contraste (p. ej. `--ink-soft` o `--line-strong`, ambos neutros/cálidos) en vez de introducir un token nuevo — decisión final a confirmar en implementación tras ver el estilo real, documentada como comentario junto a `ROAD_LAYER_IDS`. Este es exactamente el mismo patrón de extracción ya usado en el componente (`route-map-photos.ts`), mencionado en la advertencia inicial.

## Paso 4: Marcadores de inicio y fin como icono [x]

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/57
- **Objetivo**: Sustituir los círculos CSS actuales de inicio/fin por un icono tipo pin/bandera, manteniendo `--success`/`--amber` como color base vía CSS (no hardcodeado).
- **AC cubiertos**: AC-010, AC-011, AC-012 (parcial — ver advertencia inicial), AC-025
- **Tests a escribir**:
  - En `route-map.element.spec.ts`:
    - Test: "start and end markers use the new pin-icon markup instead of a plain circle" → inspecciona el elemento pasado a `markerCtor` para cada marcador (`findMarkerElements` ya existe para fotos; se necesita un helper equivalente para `route-map-marker--start`/`--end`, o filtrar directamente por clase) y comprueba que incluye una clase nueva (p. ej. `route-map-marker--pin`) y/o un nodo hijo (p. ej. un `<svg>` o `<span>` de icono) distinto del div vacío actual → Valida AC-010, AC-025.
    - Test (regresión): el número de marcadores sigue siendo 2 (`markerCtor` llamado 2 veces) y las clases `route-map-marker--start`/`--end` se mantienen (no rompe el resto de tests ni `mejoras-fotos-mapa`, que no toca estos marcadores).
  - En `route-map.element.css.spec.ts`:
    - Test: "`.route-map-marker--start` resolves `--success` and `.route-map-marker--end` resolves `--amber` as their base color, not a hardcoded value" → comprueba que el CSS resuelto contiene, para cada selector, `var(--success)`/`var(--amber)` (no un literal de color) → Valida AC-011.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: en `addMarker()`, construir el elemento con una nueva clase `route-map-marker--pin` (además de `--start`/`--end` ya existentes) y un nodo interno tipo icono (SVG inline con `fill="currentColor"`, o pseudo-elemento CSS con `clip-path` — a decidir en implementación); mantener `data-cy`/estructura suficiente para que el clic siga funcionando igual que hoy (estos marcadores no son clicables actualmente, así que no hay regresión de comportamiento, solo de apariencia).
  - `MODIFICAR src/shared/route-map/route-map.element.css`: sustituir el bloque `.route-map-marker--start`/`--end` (círculo) por la forma de pin/bandera; `color: var(--success)`/`var(--amber)` en el marcador correspondiente (el icono usa `currentColor`), preservando `box-shadow: var(--shadow-btn)` si aporta legibilidad sobre el mapa.
  - `MODIFICAR src/shared/route-map/route-map.element.css.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`.
- **Notas**: Los marcadores de foto/cluster (`.route-map-marker--photo`/`--cluster`) **no se tocan** — son de `mejoras-fotos-mapa` y están fuera de alcance de esta spec (Constraints). Confirmar que el nuevo estilo de pin no afecta al selector base `.route-map-marker` compartido con esas clases (usar clases específicas nuevas en vez de modificar la clase raíz si hay riesgo de colisión).

## Paso 5: Controles de zoom

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/58
- **Objetivo**: Añadir `NavigationControl` (o control equivalente) siempre visible, con hitbox 56×56px, en una esquina que no compita con el botón de pantalla completa.
- **AC cubiertos**: AC-013, AC-014, AC-015 (parcial — el no-solape final con fullscreen se confirma visualmente en el Paso 7 una vez montado el botón del Paso 6), AC-026
- **Tests a escribir**:
  - Extender el mock de `maplibre-gl` en `route-map.element.spec.ts`: añadir una clase/constructor mockeado `NavigationControl` (`vi.fn()` o clase vacía) al factory de `vi.mock('maplibre-gl', ...)`, y `addControl: vi.fn()` a `mockMapInstance`.
  - Test: "adds a NavigationControl to the map, positioned in a corner distinct from the fullscreen button" → `expect(addControl).toHaveBeenCalledWith(expect.any(NavigationControlMock), 'top-left')` (o la esquina elegida) → Valida AC-013, AC-026, AC-015 (posición).
  - En `route-map.element.css.spec.ts`:
    - Test: "zoom control buttons have a minimum 56x56 hitbox, overriding MapLibre's default size" → comprueba que el CSS resuelto contiene una regla sobre la clase de botones del control de navegación de MapLibre (p. ej. `.maplibregl-ctrl-group button`) con `min-width`/`min-height` igual a `var(--hitbox-min)` → Valida AC-014.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: en `initMap()`, tras crear `map`, `map.addControl(new maplibregl.NavigationControl(), 'top-left')` (o la esquina que finalmente no choque con el botón de pantalla completa del Paso 6, pensado en 'top-right').
  - `MODIFICAR src/shared/route-map/route-map.element.css`: override de `.maplibregl-ctrl-group`/`.maplibregl-ctrl-group button` para ampliar la hitbox a `var(--hitbox-min)` (56px) sin desbordar el contenedor de 200px de alto; ajustar el `margin`/posición del grupo de controles para dejar hueco al botón de pantalla completa.
  - `MODIFICAR src/shared/route-map/route-map.element.css.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`.
- **Notas**: Verificar el nombre de clase real de los botones de `NavigationControl` contra `maplibre-gl/dist/maplibre-gl.css` (histórico: `.maplibregl-ctrl-group button`), igual que en el Paso 2 para atribución.

## Paso 6: Botón de pantalla completa

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/59
- **Objetivo**: Botón integrado (hitbox 56×56, `aria-label` dinámico) que invoca la Fullscreen API real sobre el contenedor del mapa, preserva centro/zoom vía `map.resize()`, se sincroniza con `fullscreenchange` (botón y Esc), degrada sin error si no hay soporte, y no anima si `prefers-reduced-motion` está activo.
- **AC cubiertos**: AC-016, AC-017, AC-018, AC-019, AC-020, AC-021, AC-027, AC-028, AC-029
- **Tests a escribir**:
  - Nuevo archivo `src/shared/route-map/route-map-fullscreen.spec.ts` (lógica de detección/estado, aislada de DOM real de MapLibre):
    - Test: "reports fullscreen as supported only when `document.fullscreenEnabled` is true and the container exposes `requestFullscreen`" → cubre la función de detección exportada (p. ej. `isFullscreenSupported(container)`) con combinaciones `true`/`false`/método ausente → Valida el mecanismo de AC-020.
    - Test: "resolves the current fullscreen state (entering/exiting) by comparing `document.fullscreenElement` against the given container" → cubre una función pura de estado (p. ej. `isElementFullscreen(container)`).
  - En `route-map.element.spec.ts` (o en un nuevo bloque `describe('pantalla completa (AC-016 a AC-021)')` dentro del mismo archivo, para reutilizar `mountRouteMap`):
    - Setup adicional en `beforeEach`/helpers: `Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })`, stub de `HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)`, `document.exitFullscreen = vi.fn().mockResolvedValue(undefined)`, y un helper `simulateFullscreenChange(toElement: Element | null)` que define `document.fullscreenElement` (vía `Object.defineProperty`, `configurable: true`) y dispara `document.dispatchEvent(new Event('fullscreenchange'))`.
    - Extender el mock de `mockMapInstance`: añadir `resize: vi.fn()`.
    - Test: "clicking the fullscreen button in normal state calls `requestFullscreen()` on the map container" → Valida AC-016, AC-017, AC-027.
    - Test: "after simulating `fullscreenchange` entering fullscreen, calls `map.resize()` and updates the button's aria-label/icon to the exit state" → Valida AC-018, AC-019, AC-027.
    - Test: "clicking the button while already in fullscreen calls `document.exitFullscreen()`" → Valida AC-019, AC-028.
    - Test: "after simulating `fullscreenchange` exiting fullscreen (e.g. via Esc), calls `map.resize()` again and restores the original aria-label/icon" → Valida AC-019, AC-028.
    - Test: "does not call any map center/zoom-changing method (`setCenter`/`jumpTo`/`flyTo`) as part of entering or exiting fullscreen — only `resize()`" (test de guarda para AC-018/AC-019: MapLibre's `resize()` ya preserva centro/zoom internamente, así que no debe haber ninguna llamada manual a recolocar la cámara) → Valida AC-018, AC-019.
    - Test: "does not render the fullscreen button when `document.fullscreenEnabled` is false" → Valida AC-020, AC-029.
    - Test: "does not render the fullscreen button when the container lacks `requestFullscreen`" (navegador/WebView sin el método) → Valida AC-020, AC-029.
  - En `route-map.element.css.spec.ts`:
    - Test: "the fullscreen button has a minimum 56x56 hitbox and sits in the top-right corner" → Valida AC-016.
    - Test: "the fullscreen icon transition relies on the global reduced-motion override, no exemption of its own" (mismo patrón que el Paso 1) → Valida AC-021.
- **Archivos a crear/modificar**:
  - `CREAR src/shared/route-map/route-map-fullscreen.ts`: módulo de responsabilidad única (mismo patrón que `route-map-photos.ts`) que expone:
    - `isFullscreenSupported(container: HTMLElement): boolean`
    - `isElementFullscreen(container: HTMLElement): boolean`
    - `createFullscreenToggle(container: HTMLElement, map: maplibregl.Map): { element: HTMLButtonElement; destroy: () => void } | null` — devuelve `null` si no hay soporte (AC-020); si lo hay, construye el botón (`aria-label` inicial, icono), engancha el `click` (toggle `requestFullscreen()`/`exitFullscreen()`) y un listener de `document.addEventListener('fullscreenchange', ...)` que actualiza `aria-label`/icono y agenda `requestAnimationFrame(() => map.resize())`; `destroy()` quita el listener de `fullscreenchange` (se llama desde `destroyMap()`/`disconnectedCallback` de `route-map.element.ts`, evitando fugas).
  - `CREAR src/shared/route-map/route-map-fullscreen.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.ts`: en `initMap()` (o justo después, una vez `map` existe), llamar a `createFullscreenToggle(container, map)`; si no es `null`, añadir el botón al `container` (esquina superior derecha) y guardar su `destroy()` para invocarlo en `destroyMap()`.
  - `MODIFICAR src/shared/route-map/route-map.element.css`: `.route-map-fullscreen-toggle` — `position: absolute; top/right; min-width/min-height: var(--hitbox-min);`, icono con `transition` (sujeta al override global de `prefers-reduced-motion`), sin solaparse con el grupo de zoom (Paso 5, esquina opuesta) ni con la atribución (Paso 2, esquina inferior).
  - `MODIFICAR src/shared/route-map/route-map.element.css.spec.ts`.
  - `MODIFICAR src/shared/route-map/route-map.element.spec.ts`.
- **Notas**: `map.resize()` de MapLibre ya preserva el centro/zoom internamente (no re-centra el mapa, solo remide el canvas) — este plan asume que **no** hace falta capturar/reaplicar manualmente `getCenter()`/`getZoom()`, solo invocar `resize()` en el próximo frame tras `fullscreenchange` (nota de implementación de la spec). Si la verificación manual en dispositivo real (Paso 7) revelara lo contrario, habría que añadir esa captura/reaplicación explícita — dejarlo anotado como riesgo a confirmar, no una decisión cerrada. El listener de `fullscreenchange` se registra en `document`, no en el contenedor — hay que limpiarlo explícitamente en `destroy()`/`disconnectedCallback()` para no acumular listeners huérfanos entre montajes/desmontajes de `<route-map>` (p. ej. al navegar entre rutas en `<route-detail>`).

## Paso 7: Regresión completa + cierre de verificaciones manuales

- **Issue**: https://github.com/GonzaloCarmenado/moto-routes/issues/60
- **Objetivo**: Confirmar que las 6 mejoras conviven sin solaparse ni romper `mejoras-fotos-mapa`, y cerrar las verificaciones que los tests unitarios (con `maplibre-gl` mockeado) no pueden confirmar por sí solos.
- **AC cubiertos**: AC-002, AC-009 (definitivo), AC-012, AC-015 (definitivo), AC-020 (verificación en dispositivo/WebView real)
- **Tests a escribir**: ninguno nuevo — este paso ejecuta la suite completa (`pnpm test` / `pnpm test:coverage`) y confirma que los tests de `mejoras-fotos-mapa` (marcadores de foto, clustering, popup) del mismo archivo `route-map.element.spec.ts` siguen en verde sin haber sido tocados por los Pasos 1-6.
- **Archivos a crear/modificar**: ninguno (paso de verificación, no de implementación).
- **Notas**:
  - Verificación visual manual (navegador o Android real) de: contraste real de las vías vs. fondo (AC-002), contraste del icono de marcador (AC-012), que atribución/zoom/fullscreen no se solapan visualmente en el contenedor de 200px (AC-009, AC-015 definitivos).
  - Verificación específica en el WebView de Android (target prioritario del proyecto, ADR-018): comprobar si soporta la Fullscreen API (`document.fullscreenEnabled`) — si no la soporta, confirmar que el botón simplemente no aparece (AC-020) sin error en consola, siguiendo el mismo patrón de "verificación pendiente en dispositivo real" ya usado en otras features de este proyecto (ver `memory/context.md`).
  - Si alguna de estas verificaciones manuales revela una desviación (p. ej. el WebView de Android sí soporta Fullscreen API pero con comportamiento distinto al de Chrome desktop), no se ignora: se corrige el código o se anota como ADR/nota en la spec, según corresponda — nunca se deja desalineado (regla de oro de `CLAUDE.md`).
