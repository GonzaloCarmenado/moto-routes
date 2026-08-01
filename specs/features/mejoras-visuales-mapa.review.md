# Revisión: Mejoras Visuales y de Interacción del Mapa (`<route-map>`)

## 📋 Ficheros Tocados
| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/route-map/route-map.element.ts` | MODIFICADO | Skeleton de carga, `attributionControl: {compact:true}`, orquestación de overrides de contraste, marcadores pin `anchor:'bottom'`, integración del botón fullscreen, `collapseAttribution()` |
| `src/shared/route-map/route-map.element.css` | MODIFICADO | Estilos de skeleton, atribución (tamaño + opacidad), marcador pin, botón fullscreen, hitarea de marcadores de foto |
| `src/shared/route-map/route-map-contrast.ts` | CREADO | `ROAD_LAYER_IDS`, `ROAD_LABEL_LAYER_IDS`, `buildRoadContrastOverrides`, `buildRoadLabelContrastOverrides` (funciones puras) |
| `src/shared/route-map/route-map-fullscreen.ts` | CREADO | `isFullscreenSupported`, `isElementFullscreen` (con fix de retargeting de Shadow DOM), `createFullscreenToggle` |
| `src/shared/route-map/route-map-photos.ts` | MODIFICADO | Envuelve icono de foto/cluster en `.route-map-marker-hitarea` (56×56) sin alterar tamaño visual |
| `src/shared/route-map/route-map.element.spec.ts` | MODIFICADO | Refactor de mock `load` (síncrono → `triggerLoad()`), nuevos `describe` por AC, tests de fullscreen/contraste/anclaje/atribución colapsada |
| `src/shared/route-map/route-map-contrast.spec.ts` | MODIFICADO | Tests de `buildRoadContrastOverrides`/`buildRoadLabelContrastOverrides` |
| `src/shared/route-map/route-map-fullscreen.spec.ts` | MODIFICADO | Tests de soporte/estado de fullscreen, incluido caso Shadow DOM |
| `src/shared/route-map/route-map.element.css.spec.ts` | MODIFICADO | Tests de CSS resuelto (hitboxes, opacidad, colores de token, reduced-motion) |
| `specs/features/mejoras-visuales-mapa.md` / `.plan.md` | MODIFICADO | Documento de spec/plan actualizado con 3 rondas de feedback real (Pasos 8-10) |
| `memory/context.md` | MODIFICADO | Bitácora de sesión |

## 📝 Resumen de Cambios
- Contraste de vías (`line-color`) y ahora también de etiquetas (`text-color`) sobre capas reales del estilo `dark` de OpenFreeMap, con manejo de error por capa (`try/catch` individual).
- Ancho de vía reducido vía escalado de la expresión de interpolación existente (`['*', current, 0.5]`), no un valor fijo — preserva progresión motorway>minor.
- Skeleton de carga sobre `--panel-sunken`, retirado en `load` antes de dibujar ruta/marcadores.
- Atribución OpenFreeMap/OSM reactivada (`{compact:true}`), estilo discreto (tamaño + opacidad reducida en reposo, completa en hover/foco) y colapsada tras `load` replicando el comportamiento interno de MapLibre al arrastrar.
- Marcadores de inicio/fin: SVG tipo pin con `currentColor`, colores vía `--success`/`--amber`, ancla `anchor:'bottom'` (punta apoyada en la coordenada real).
- Controles de zoom implementados y luego retirados por decisión de producto (AC-013/014/015/026), documentado en spec/plan/código.
- Botón de pantalla completa real (Fullscreen API) sobre el contenedor exterior, sincronizado vía `fullscreenchange`, con fix de un bug real de retargeting de `fullscreenElement` en Shadow DOM (`ShadowRoot.fullscreenElement`), degradación segura sin soporte, `map.resize()` en frame siguiente, sin recentrar manualmente.
- Marcadores de foto/cluster: hitbox ampliada a 56×56 mediante wrapper invisible, sin tocar tamaño/posición visual del icono ni la lógica de clustering.
- 527/527 tests TS en verde (70 en `route-map`, verificado en esta revisión), ESLint 0 warnings (verificado), tsc/Prettier limpios (según el propio commit).

## ✅ Cumplimiento de AC
| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `route-map.element.ts:229-238`, `route-map-contrast.ts` | `route-map.element.spec.ts:489-500`, `route-map-contrast.spec.ts:9-19` | Overrides vía `setPaintProperty`, no sustituye el estilo |
| AC-002 | ✅ Cumplido (verificación manual) | — | — | No verificable en Vitest (documentado en el plan); confirmado en dispositivo real por el usuario |
| AC-003 | ✅ Cumplido | `route-map.element.ts:232-247` (`try/catch` por capa) | `route-map.element.spec.ts:521-534` | `setPaintProperty` lanzando no aborta `addSource`/`addLayer`/`fitBounds`/marcadores |
| AC-004 | ✅ Cumplido | `--ink-faint`/`--ink-soft` (tokens de paleta) | `route-map-contrast.spec.ts:21-34` | Guarda de "no azules fríos"; color real resuelto vía `resolveToken` |
| AC-005 | ✅ Cumplido | `route-map.element.ts:135-139`, `route-map.element.css:28-40` | `route-map.element.spec.ts:418-430` | Skeleton visible antes de `load` |
| AC-006 | ✅ Cumplido | `route-map.element.ts:184-189` (skeleton se quita antes de `drawRoute`) | mismo test que AC-005 | Sin solape verificado (ausencia tras `load`) |
| AC-007 | ✅ Cumplido | CSS sin `@media` propio, hereda override global | `route-map.element.css.spec.ts:14-27` | Mismo patrón ya usado en el proyecto |
| AC-008 | ✅ Cumplido | `route-map.element.ts:160` `attributionControl:{compact:true}` | `route-map.element.spec.ts:382-390` | — |
| AC-009 | ✅ Cumplido | `route-map.element.css:55-81` (tamaño + opacidad) | `route-map.element.css.spec.ts:29-45` | Verificación de no-solape final: manual (dispositivo real) |
| AC-010 | ✅ Cumplido | `route-map.element.ts:313-322` (SVG pin) | `route-map.element.spec.ts:442-455` | — |
| AC-011 | ✅ Cumplido | `route-map.element.css:180-186` (`var(--success)`/`var(--amber)`) | `route-map.element.css.spec.ts:47-55` | Sin hardcode, `currentColor` en SVG |
| AC-012 | ✅ Cumplido (verificación manual) | — | — | No verificable con `maplibre-gl` mockeado; confirmado en dispositivo real |
| AC-013/014/015 | ✅ Retirado (decisión de producto) | — | — | Documentado en spec con justificación y fecha; código eliminado íntegramente (no queda residuo — confirmado leyendo `route-map.element.ts`/`.css`) |
| AC-016 | ✅ Cumplido | `route-map-fullscreen.ts:90-97`, CSS `top-right` + hitbox | `route-map.element.spec.ts:613-626`, `route-map.element.css.spec.ts:57-63` | — |
| AC-017 | ✅ Cumplido | `route-map-fullscreen.ts:113-119` | `route-map.element.spec.ts:613-626` | `requestFullscreen()` real, no simulación CSS |
| AC-018 | ✅ Cumplido | `route-map-fullscreen.ts:99-111` (`resize()` en rAF) | `route-map.element.spec.ts:628-640`, `673-687` | Sin `setCenter`/`jumpTo` — verificado explícitamente |
| AC-019 | ✅ Cumplido (bug corregido) | `route-map-fullscreen.ts:70-76` (`ShadowRoot.fullscreenElement`) | `route-map.element.spec.ts:642-671`, `route-map-fullscreen.spec.ts:59-84` | Bug real documentado y con test de regresión específico para el caso Shadow DOM |
| AC-020 | ✅ Cumplido | `route-map-fullscreen.ts:46-48`, `createFullscreenToggle` devuelve `null` | `route-map.element.spec.ts:689-707`, `route-map-fullscreen.spec.ts:4-28` | — |
| AC-021 | ✅ Cumplido | CSS `transition` sin `@media` propio | `route-map.element.css.spec.ts:73-77` | — |
| AC-022 | ✅ Cumplido | igual que AC-001 | igual que AC-001 | — |
| AC-023 | ✅ Cumplido | igual que AC-005 | igual que AC-005 | — |
| AC-024 | ✅ Cumplido | igual que AC-008 | igual que AC-008 | — |
| AC-025 | ✅ Cumplido | igual que AC-010 | igual que AC-010 | — |
| AC-026 | ✅ Retirado | — | — | Test eliminado junto con el `describe` de controles de zoom, coherente con AC-013/014/015 |
| AC-027 | ✅ Cumplido | igual que AC-017/018 | igual que AC-017/018 | — |
| AC-028 | ✅ Cumplido | `route-map-fullscreen.ts:113-119` | `route-map.element.spec.ts:642-671` | `exitFullscreen()` + restauración de aria-label |
| AC-029 | ✅ Cumplido | igual que AC-020 | igual que AC-020 | — |
| AC-030 | ✅ Cumplido | `route-map.element.ts:258-262` (`thinRoadLine`, `ROAD_WIDTH_SCALE`) | `route-map.element.spec.ts:506-519` | Escala expresión existente, no valor fijo |
| AC-031 | ✅ Cumplido | `route-map-contrast.ts:36-49`, `route-map.element.ts:240-247` | `route-map.element.spec.ts:541-562` | Color de etiqueta distinto del de vía, verificado explícitamente |
| AC-032 | ✅ Cumplido | igual que AC-030/031 | igual que AC-030/031 | Cubierto por 2 tests independientes (misma cobertura funcional) |
| AC-033 | ✅ Cumplido | `route-map.element.css:72-81` | `route-map.element.css.spec.ts:35-45` | Opacidad 0.35 en reposo, 1 en hover/focus-visible |
| AC-034 | ✅ Cumplido | `route-map.element.ts:317-321` (`anchor:'bottom'`) | `route-map.element.spec.ts:471-485` | — |
| AC-035 | ✅ Cumplido | `ROAD_WIDTH_SCALE = 0.5` | reutiliza test de AC-030 (por diseño, ver plan) | Valor no fijado numéricamente en el test, a propósito |
| AC-036 | ✅ Cumplido | `route-map-photos.ts:51-58`, CSS `.route-map-marker-hitarea` | `route-map.element.spec.ts:327-357`, `route-map.element.css.spec.ts:65-71` | Wrapper no cambia tamaño/posición del icono |
| AC-037 | ✅ Cumplido | conjunto de los anteriores | conjunto de los anteriores | — |
| AC-038 | ✅ Cumplido | `route-map.element.ts:264-280` (`collapseAttribution`) | `route-map.element.spec.ts:399-415` | Simula clases/atributo reales de MapLibre |
| AC-039 | ✅ Cumplido | igual que AC-038 | igual que AC-038 | — |

**Cobertura AC: 39/39 marcados, 35/39 con test automatizado, 4 con verificación manual documentada (AC-002, AC-009 parcial de no-solape, AC-012, AC-020 en WebView Android real — todos explícitamente señalados como no verificables por Vitest en el propio plan), 4 retirados por decisión de producto documentada (AC-013/014/015/026).**

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias. No hay secretos, no se introduce ningún origen nuevo de red (sigue usando `tiles.openfreemap.org`, ya aprobado en la spec base). Inputs (`points`, `photos`) no cambian de forma de validación respecto a la spec base. CSP no se toca en este feature.

### Componentes Comunes Afectados
- ⚠️ `src/shared/route-map/` es un componente compartido (usado hoy solo por `route-detail`, según la propia spec — "Dependencias"). Todos los cambios están confinados a este directorio; no se ha tocado `src/shared/styles/tokens.css` ni otros componentes de `shared/`. Impacto real: bajo, un único consumidor, comportamiento aditivo o corrección de regresión, sin cambios de API pública del componente (`points`/`photos` sin modificar).

### Actualizaciones Core
- ✅ Ninguna. No hay cambios en `package.json`, `tsconfig`, `vite.config.ts`, `eslint.config.js` ni `tauri.conf.json` en este diff.

### Normas Saltadas
- ✅ Ninguna. Las tres rondas de correcciones (Pasos 8-10) se aplicaron directamente sobre la spec abierta en vez de crear specs nuevas — justificado explícitamente en el plan ("la spec/plan de `mejoras-visuales-mapa` sigue abierta, sin veredicto de `review-agent`, así que las correcciones van directamente aquí"), consistente con la regla de oro de `CLAUDE.md` de no dejar código y spec desalineados. No se detecta ningún salto de regla de `.claude/agents`/`CLAUDE.md` sin justificar.

## ⚠️ Issues Encontrados

### ISSUE-001: `ROAD_WIDTH_SCALE` es un valor no calibrado, ajustado dos veces por percepción subjetiva
- **Severidad**: BAJA
- **AC afectado**: AC-030, AC-035
- **Descripción**: El propio plan documenta explícitamente que `ROAD_WIDTH_SCALE` (0.7 → 0.5) "sigue sin ser una medición formal de contraste" — es una aproximación por ensayo-error basada en feedback subjetivo del usuario. No es un defecto de implementación (el mecanismo de escalado es correcto y está bien testeado), pero es un valor "mágico" sin trazabilidad a una medición objetiva de contraste, susceptible de un cuarto ajuste futuro.
- **Recomendación**: Ninguna acción bloqueante. Si en una futura iteración se vuelve a tocar, considerar documentar el ratio de contraste real medido (aunque sea con una herramienta externa fuera del pipeline de tests) para evitar una cuarta ronda de "prueba y error" en producción.

### ISSUE-002: `map.resize()` se invoca en cada `fullscreenchange` del documento, no solo el propio del contenedor de esta instancia
- **Severidad**: BAJA
- **AC afectado**: AC-018, AC-019
- **Descripción**: `createFullscreenToggle` registra `document.addEventListener('fullscreenchange', syncState)` sin filtrar si el evento corresponde a este `<route-map>` en concreto. Si hubiera más de una instancia de `<route-map>` montada simultáneamente (hoy no ocurre — un único consumidor, `route-detail`, monta una sola instancia a la vez, según "Dependencias" de la spec), cada instancia recalcularía `isElementFullscreen()`/`resize()` en cada cambio de fullscreen del documento, aunque no le corresponda. Con un único consumidor actual esto no tiene efecto observable.
- **Recomendación**: No bloqueante hoy. Si en el futuro `<route-map>` se usara en más de un lugar simultáneo (fuera del alcance actual, ver "Fuera de alcance" de la spec), valdría la pena añadir una comprobación temprana en `syncState` (p. ej. ignorar si ni `document.fullscreenElement` ni `ShadowRoot.fullscreenElement` cambiaron respecto al contenedor propio) para evitar trabajo redundante.

## 📊 Veredicto
- [x] APPROVED WITH MINOR ISSUES

Los 39 AC de la spec están cumplidos: 35 con test automatizado deterministic, 4 explícitamente marcados desde el propio plan como solo verificables manualmente (y confirmados en dispositivo Android real por el usuario), y 4 retirados formalmente por decisión de producto con justificación documentada en spec y código (sin residuo de código muerto). El bug real de fullscreen en Shadow DOM se diagnosticó correctamente, se corrigió con un fix específico y tiene test de regresión dedicado. No hay gaps, no hay desviaciones no documentadas, no hay hallazgos de seguridad, no hay actualizaciones de dependencias core, y no se saltó ninguna norma sin justificación. Los dos issues encontrados son de severidad baja, no bloqueantes, y no requieren cambio de código antes de cerrar la spec — quedan anotados para referencia futura.
