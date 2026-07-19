# Revisión: Visualización de Ruta en Mapa (MapLibre + OpenFreeMap)

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|-------------------------|
| `src/shared/route-map/route-map.element.ts` | CREADO | Web Component `<route-map>`: inicializa MapLibre GL, dibuja trazado GeoJSON, marcadores inicio/fin, `fitBounds`, ciclo de vida |
| `src/shared/route-map/route-map.element.css` | CREADO | Estilos del componente (tokens del sistema, `:host` 200px, marcadores, estado vacío) |
| `src/shared/route-map/route-map.transform.ts` | CREADO | `toGeoJSON` (conversión `{lat,lng}` → `[lng,lat]`) y `computeBounds`, funciones puras |
| `src/shared/route-map/route-map.element.spec.ts` | CREADO | Tests unitarios con `maplibre-gl` mockeado (AC-016 a AC-018) |
| `src/shared/route-map/route-map.transform.spec.ts` | CREADO | Tests unitarios puros del transform (AC-009) |
| `src/routes/route-detail.element.ts` | MODIFICADO | Elimina Leaflet (`import L from 'leaflet'`, `buildMap` con lógica Leaflet); `buildMap` ahora crea `<route-map>` y le pasa puntos `{lat,lng}` limpios |
| `src/routes/route-detail.element.css` | MODIFICADO | Elimina reglas muertas `.route-map`, `.route-map svg`, `.map-tag` (el contenedor ahora vive dentro del shadow DOM de `<route-map>`) |
| `src/routes/route-detail.element.spec.ts` | MODIFICADO | Mock de `leaflet` → mock de `maplibre-gl`; sustituye los 2 tests que asumían `#map`/`.map-empty` por tests de integración con `<route-map>` (AC-019) |
| `package.json` / `pnpm-lock.yaml` | MODIFICADO | `+maplibre-gl`, `−leaflet`, `−@types/leaflet` |
| `src-tauri/tauri.conf.json` | MODIFICADO | CSP: `+tiles.openfreemap.org`, `+worker-src 'self' blob:`, `+blob:` en `img-src`, `−*.tile.openstreetmap.org` |
| `index.html` | MODIFICADO | CSP del `<meta>` equivalente a la de `tauri.conf.json` |
| `specs/features/mapa-ruta-leaflet.md` | MODIFICADO | Marcada como SUPERSEDED por esta spec |
| `specs/features/mapa-ruta-maplibre.md` / `.plan.md` | CREADO | Spec y plan de este feature |

## 📝 Resumen de Cambios

- Nuevo componente reutilizable `<route-map>` en `src/shared/`, independiente de Tauri, del repositorio SQL y de `<route-detail>`.
- Renderiza MapLibre GL JS con el estilo oscuro nativo de OpenFreeMap (`https://tiles.openfreemap.org/styles/dark`), sin API key.
- Trazado GPS pintado en crudo como `LineString` GeoJSON, color ámbar resuelto desde el token `--amber` vía `getComputedStyle` (necesario porque las paint properties de MapLibre no aceptan `var()` directamente).
- Marcadores de inicio/fin como elementos DOM con clases CSS que usan `var(--success)`/`var(--amber)` — no requieren resolución JS porque los custom properties sí heredan de forma nativa dentro de Shadow DOM.
- `<route-detail>` queda desacoplado de cualquier librería de mapas concreta: solo pasa `points: {lat,lng}[]`.
- CSP endurecida de forma mínima y específica (un solo host añadido, `worker-src blob:` acotado a `'self' blob:'`, nada de wildcards).
- Verificado en navegador real (Cypress headless, script de verificación no comiteado): mapa oscuro con calles reales de Madrid, marcador verde de inicio, marcador ámbar de fin, canvas WebGL, **cero errores de CSP en consola**.

## ✅ Cumplimiento de AC

| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `package.json` | — | `+maplibre-gl`, `−leaflet`, `−@types/leaflet` |
| AC-002 | ✅ Cumplido | `tauri.conf.json:26`, `index.html:8` | Verificación manual en navegador (0 errores CSP) | Ambas CSP idénticas en contenido |
| AC-003 | ✅ Cumplido | `route-map.element.ts`, `route-map.element.css` | — | Sin imports de Tauri, SQL ni `route-detail` |
| AC-004 | ⚠️ Cumplido con gap de test | `route-map.element.ts:16-19` (setter `points`) | `route-map.element.spec.ts` | El setter sí re-renderiza si `isConnected`, pero ningún test asigna `points` **después** de montar el elemento (todos lo hacen antes de `appendChild`). Ver ISSUE-001 |
| AC-005 | ✅ Cumplido | `route-map.element.ts:7,80-86` | Verificación manual en navegador | Usa el estilo `dark` real de OpenFreeMap (confirmado por investigación externa, no listado en el quick-start oficial). Ver ISSUE-002 |
| AC-006 | ✅ Cumplido | `route-map.element.ts:94-108` | `route-map.element.spec.ts` (`addLayer` llamado) | Orden preservado (viene ya ordenado por `timestamp` desde el repositorio) |
| AC-007 | ✅ Cumplido | `route-map.element.ts:110-111,119-123` | `route-map.element.spec.ts` (`markerCtor` x2) | — |
| AC-008 | ✅ Cumplido | `route-map.element.ts:113-116` | `route-map.element.spec.ts` (`fitBounds` llamado) | Padding 50 |
| AC-009 | ✅ Cumplido | `route-map.transform.ts:17-26` | `route-map.transform.spec.ts` | Orden `[lng,lat]` verificado explícitamente en test |
| AC-010 | ✅ Cumplido | `route-map.element.ts:61-67` | `route-map.element.spec.ts` | `mapCtor` no se llama cuando `points=[]` |
| AC-011 | ✅ Cumplido | `route-map.element.ts:34-43,45-46` | `route-map.element.spec.ts` (`remove` en disconnect) | `destroyMap()` se llama tanto en cada `render()` como en `disconnectedCallback` |
| AC-012 | ✅ Cumplido | `route-map.element.ts:95,125-128`, `route-map.element.css:44-49` | — | Línea vía `getComputedStyle`; marcadores vía CSS `var()` (ambos derivan de tokens, ninguno hardcodeado en la práctica). Fallback hardcodeado sin test — ver ISSUE-003 |
| AC-013 | ✅ Cumplido | `route-map.element.ts:58` | `route-map.element.spec.ts` (indirecto vía DOM) | — |
| AC-014 | ✅ Cumplido | `route-detail.element.ts:5,123-129` | `route-detail.element.spec.ts` | Cero referencias a Leaflet en el árbol de imports |
| AC-015 | ✅ Cumplido | `route-detail.element.ts:65-120` | `route-detail.element.spec.ts` (3 tests preexistentes siguen en verde) | Botón, título, fecha, 4 stat-tiles, placeholders sin cambios |
| AC-016 | ✅ Cumplido | — | `route-map.element.spec.ts` ("should initialize...") | — |
| AC-017 | ✅ Cumplido | — | `route-map.element.spec.ts` ("should show Sin datos...") | — |
| AC-018 | ✅ Cumplido | — | `route-map.element.spec.ts` ("should destroy...") | — |
| AC-019 | ✅ Cumplido | — | `route-detail.element.spec.ts` (2 tests nuevos) | Verifica también que se limpian los campos de dominio (`id`, `timestamp`, `alt`, `speed`) antes de pasar a `<route-map>` |

**19/19 AC implementados. 18/19 con cobertura de test completa; AC-004 tiene un gap de cobertura menor (no funcional).**

## 🔴 CRÍTICO

### Seguridad
✅ Sin incidencias.
- Sin secretos ni API keys (OpenFreeMap no las requiere).
- CSP ampliada de forma mínima y específica: un host (`tiles.openfreemap.org`), `worker-src 'self' blob:` (necesario para los Web Workers de MapLibre, sin `unsafe-eval` ni wildcards).
- Verificado en navegador real: cero violaciones de CSP durante carga y render completo del mapa.
- Sin `innerHTML` con datos no confiables en el código nuevo; los puntos vienen de SQLite local, no de input de usuario ni red externa no controlada.

### Componentes Comunes Afectados
⚠️ Se introduce un componente nuevo en `src/shared/`: `src/shared/route-map/`.
- No modifica ningún archivo compartido existente (`base-element.ts`, `tokens.css`, `dom.ts` intactos).
- Único consumidor actual: `<route-detail>`. Impacto real = 0 en el resto de la app.
- Nota de coherencia (no bloqueante): a diferencia de `cockpit.element.ts` y `counter.element.ts` (que extienden `BaseElement`), `route-map.element.ts` extiende `HTMLElement` directamente — mismo patrón que `route-detail.element.ts` y `route-list.element.ts` ya usaban antes de este feature. Es una inconsistencia preexistente en el proyecto, no introducida aquí.

### Actualizaciones Core
⚠️ Cambio de dependencia central de renderizado de mapas: `leaflet` (1.9.4) → `maplibre-gl` (5.24.0).
- Justificación: decisión de producto explícita y acordada con el usuario en esta misma sesión (precisión visual, sin API key, camino a offline). Documentada en `specs/features/mapa-ruta-maplibre.md` § Constraints y en `mapa-ruta-leaflet.md` (marcada SUPERSEDED).
- Impacto en bundle: +~300KB gzip (aceptado explícitamente en la spec como decisión de producto). El build genera el aviso esperado de chunk >200KB; no se ha aplicado `import()` dinámico (la spec lo deja como opcional "si molesta", no obligatorio).
- No se han tocado TypeScript, Vite, ESLint ni otras herramientas de build/lint.

### Normas Saltadas
✅ Ninguna.
- El CSS de `maplibre-gl` se importa con `?inline` y se inyecta dentro del propio `<style>` del Shadow DOM del componente — esto es una **mejora** respecto a la implementación Leaflet anterior, que importaba `leaflet.css` como side-effect en el módulo (quedando fuera del Shadow DOM, un bug silencioso no detectado en su momento).
- La dependencia `maplibre-gl` fue preguntada y aprobada explícitamente por el usuario antes de instalarse (no se saltó la regla de `frontend-conventions.md` §10.3).

## ⚠️ Issues Encontrados

### ISSUE-001: Falta test de re-render tras reasignar `points` con el componente ya montado
- **Severidad**: MEDIA
- **AC afectado**: AC-004
- **Descripción**: El setter `points` (`route-map.element.ts:16-19`) llama a `this.render()` cuando `this.isConnected` es `true`, cumpliendo el AC ("al asignar los puntos, el componente re-renderiza"). Sin embargo, los 3 tests de `route-map.element.spec.ts` asignan `points` **antes** de hacer `appendChild`, por lo que ese camino solo se ejerce vía `connectedCallback()`, nunca vía el setter con el elemento ya conectado. El reporte de cobertura confirma la rama sin cubrir (línea 18, 85% branch). Es el escenario real de "cambiar de ruta sin desmontar `<route-map>`".
- **Recomendación**: Añadir un test que monte `<route-map>` con un primer set de puntos, luego reasigne `el.points = [...]` con puntos distintos, y verifique que `map.remove()` se llamó (destrucción de la instancia anterior) y que se construyó una nueva instancia con los nuevos puntos.
- **Outcome**: ✅ **RESUELTO**. Añadido el test `'should destroy the previous map instance and rebuild it when points are reassigned while already mounted'` en `route-map.element.spec.ts`, que monta el elemento, reasigna `points` con el elemento ya conectado, y verifica `remove()` + segunda instancia de `Map` con el nuevo `center`. Pasó a la primera ejecución (confirma que el código de producción ya era correcto; solo faltaba el test). Aprovechado para extraer un helper `mountRouteMap()` que redujo el `describe` por debajo del límite de `max-lines-per-function`, evitando un warning nuevo de ESLint. 9/9 tests en verde, `tsc`/`eslint --max-warnings 0` limpios.

### ISSUE-002: El estilo `dark` de OpenFreeMap no está documentado en su Quick Start oficial
- **Severidad**: BAJA
- **AC afectado**: AC-005
- **Descripción**: `https://tiles.openfreemap.org/styles/dark` funciona (verificado en navegador real) pero solo está referenciado en el repositorio `hyperknot/openfreemap-styles`, no en la guía Quick Start pública de openfreemap.org, que solo documenta `liberty`, `bright` y `positron`. Riesgo bajo de que cambie de URL o se retire sin el mismo compromiso de estabilidad que los estilos "oficiales".
- **Recomendación**: Ninguna acción inmediata. Si en el futuro se detecta un 404 en este estilo, revisar `github.com/hyperknot/openfreemap-styles` o migrar a `positron` con overrides oscuros (alternativa ya documentada en la spec).

### ISSUE-003: Fallback de color hardcodeado sin test (`AMBER_FALLBACK`)
- **Severidad**: BAJA
- **AC afectado**: AC-012
- **Descripción**: `route-map.element.ts:10,125-128` define `AMBER_FALLBACK = '#d4880f'` como valor de reserva si `getComputedStyle(this).getPropertyValue('--amber')` devuelve vacío. En la práctica esto no ocurre nunca (el token siempre está definido en `tokens.css`), y la rama de fallback no tiene test (línea 127 sin cubrir). Es un valor hardcodeado, aunque solo se activa en un escenario defensivo improbable, no como color primario.
- **Recomendación**: Opcional — eliminar el fallback y confiar en que el token siempre resuelve (consistente con "los tokens son la fuente de verdad"), o mantenerlo y añadir un test que fuerce `getComputedStyle` a devolver cadena vacía.

### ISSUE-004: Tipos del dominio del mapa viven en `route-map.transform.ts`, no en un `.types.ts` dedicado
- **Severidad**: BAJA
- **AC afectado**: Ninguno directamente (convención, `specs/ui/frontend-conventions.md` §2)
- **Descripción**: `RouteMapPoint`, `LngLat` y `RouteLineFeature` están definidos en `route-map.transform.ts` en vez de en un `route-map.types.ts` separado, que es el patrón que sigue el resto del proyecto (p. ej. `route.types.ts` en el dominio de rutas).
- **Recomendación**: Opcional dado el tamaño actual del archivo (43 líneas). Si el dominio `route-map` crece, extraer los tipos a `route-map.types.ts`.

## 📊 Veredicto

- [x] **APPROVED** — Los 19 AC están implementados y con test unitario directo (AC-004 ya cubierto tras resolver ISSUE-001). CRÍTICO limpio: sin incidencias de seguridad, sin normas saltadas, cambio de componente compartido de impacto nulo fuera de este feature, cambio de dependencia core justificado y ya acordado con el usuario. Quedan 3 issues de severidad BAJA (ISSUE-002, ISSUE-003, ISSUE-004), ninguno bloqueante ni funcional — quality nits opcionales para un ciclo futuro.

## 🐛 Corrección posterior: el trazado no se veía (AC-012)

**Este bug SÍ pertenece a esta feature** y corrige una afirmación incorrecta de la revisión original: se marcó AC-012 como "✅ Cumplido" sin haber detectado que, en navegador real, la línea del trazado nunca llegaba a pintarse (solo los marcadores de inicio/fin eran visibles). La captura de la verificación inicial ya mostraba el síntoma, pero se atribuyó erróneamente a que la línea "se mezclaba con las calles" en vez de investigarse a fondo.

**Causa raíz**: `resolveToken()` leía `getComputedStyle(this).getPropertyValue('--amber')`, que en un *custom property* devuelve el texto **literal tal cual se escribió** en `tokens.css` (`"oklch(74% 0.17 48)"`), sin normalizar — a diferencia de una propiedad CSS estándar, donde el navegador sí calcula y serializa el valor final. MapLibre valida sus *paint properties* con su propio parser de color interno (no el motor CSS del navegador), que no reconoce la sintaxis `oklch()`. Confirmado en consola real: `Error: layers.route-line-layer.paint.line-color: color expected, "oklch(74% 0.17 48)" found`. La capa de línea quedaba silenciosamente sin renderizar; los marcadores funcionaban porque son elementos DOM con `background: var(--amber)`, resuelto por el propio motor CSS del navegador (que sí entiende `oklch()`).

**Fix aplicado** (`route-map.element.ts`, método `resolveToken`): en vez de leer el custom property directamente, se aplica el token a una propiedad CSS real (`color`) en un elemento `<span>` "sonda" insertado temporalmente, y se lee `getComputedStyle(probe).color` — ahí el navegador sí computa y serializa el color final (formato `rgb(...)`, que MapLibre sí entiende). El `<span>` se retira inmediatamente tras la lectura.

Verificado en navegador real: consola sin errores de MapLibre, trazado ámbar visible entre los marcadores de inicio y fin siguiendo los puntos GPS simulados (captura confirmada). Los 4 tests de `route-map.element.spec.ts` siguen en verde con jsdom (que no reproduce este bug — la limitación de `getComputedStyle` para *custom properties* solo se manifiesta en navegadores reales, por eso no se detectó con Vitest y requirió verificación manual en Cypress).

## 🐛 Corrección adicional: color de línea correcto pero apagado (ronda 2)

Tras el fix anterior, el usuario reportó que la línea "se ve como negra" sobre el mapa oscuro. Investigación en navegador real (Cypress + `getImageData` sobre un canvas 1×1) reveló que:

- El fix de la sonda `<span>` con `color` **funcionaba**, pero navegadores Chromium recientes (confirmado: Chrome 150) **ya no degradan `getComputedStyle().color` a `rgb()`** para colores definidos en `oklch()` — devuelven `"oklch(0.74 0.17 48)"` (solo normalizan `74%` → `0.74`, siguen en formato `oklch()`).
- MapLibre **acepta** esta forma numérica sin lanzar error (a diferencia de la forma con `%`), pero su conversión interna de OKLCH a RGB para el *shader* WebGL es aproximada/incorrecta, produciendo un naranja apagado y de bajo contraste — de ahí la percepción de "negro" del usuario. Confirmado comparando la conversión real del navegador (`rgb(254, 132, 61)`, un naranja vivo) contra lo que se veía en pantalla.
- Ni `getComputedStyle` ni `canvas.fillStyle` (leído como *string*) bajan a `rgb()` de forma fiable en este entorno; la única conversión determinista es **leer los píxeles ya renderizados** de un canvas 1×1 vía `getImageData()`, que siempre son bytes 0-255 sin ambigüedad de sintaxis.

**Fix aplicado**: `resolveToken()` ahora, tras obtener el color computado literal (`oklch(0.74 0.17 48)`), lo pinta en un canvas 1×1 oculto y lee el píxel resultante con `getImageData()`, construyendo un string `rgb(r, g, b)` explícito que se pasa a MapLibre. Esto elimina cualquier dependencia de cómo MapLibre interprete funciones de color modernas — siempre recibe RGB plano. En jsdom (tests unitarios), `canvas.getContext('2d')` no está implementado y devuelve `null`; el código cae al `fallback` existente sin romper ningún test (9/9 en verde).

Verificado en navegador real: cero errores de consola, línea renderizada con el naranja vivo correcto (contraste claramente mejorado frente a la ronda anterior, captura confirmada). El **token de diseño no cambió** (sigue siendo `--amber`, el definido en `specs/ui/design-system.md`); lo que se corrigió es la conversión de ese token a un formato que MapLibre interpreta con fidelidad.

## 🐛 Bug no relacionado detectado y corregido durante la verificación

Durante la verificación manual en navegador (fuera del alcance de los AC de esta spec) se detectó que **`<route-list>` no se refrescaba al navegar a "Rutas" tras grabar/simular una ruta en la misma sesión** (visible sobre todo en modo web, con `MemoryRouteRepository`, porque no hay recarga de página entre grabar y consultar). Causa: `route-list.element.ts` solo recargaba datos en su setter `repository` y en el primer `connectedCallback`; `nav-bar` dispara `nav-rutas` en `window`, pero nadie lo escuchaba para forzar un refetch — `app-root` solo hace show/hide del elemento, nunca lo remonta.

**Fix aplicado** (`src/routes/route-list.element.ts`): se añade un listener de `window 'nav-rutas'` en `connectedCallback` que llama a `fetchAndRender()` cada vez que se navega al listado, con su correspondiente limpieza en `disconnectedCallback`. Sigue el mismo patrón de eventos ya usado en el resto de la app. Test de regresión añadido en `route-list.element.spec.ts`. Verificado en navegador real (Cypress) con el flujo completo: simular ruta → click real en nav "Rutas" → tarjeta visible, sin ningún truco.

No afecta a ningún AC de `mapa-ruta-maplibre.md`; se documenta aquí por trazabilidad ya que se descubrió y corrigió en la misma sesión de review.
