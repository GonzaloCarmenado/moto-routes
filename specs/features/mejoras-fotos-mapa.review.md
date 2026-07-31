# Revisión: Mejoras de Integración Fotos–Mapa (Pestañas, Galería en Cuadrícula y Trazado en Listado)

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/tab-bar/tab-bar.element.ts` (+.css, +.spec.ts) | CREADO | Componente compartido de pestañas, agnóstico de dominio, contenido vía `<slot name="{id}">` |
| `src/routes/route-detail.element.ts` (+.css sin cambios, +.spec.ts) | MODIFICADO | Redesign con `<tab-bar>` ("Fotos"/"Estadísticas"/"Notas"), wiring de `route-map:photo-select` → `openPhotoViewerAt()` |
| `src/routes/route-detail.types.ts` | CREADO | `PhotoWithUrl`, `TabBarElement` — extraídos para no romper `max-lines` de ESLint |
| `src/shared/photo-gallery/photo-gallery.element.ts` (+.css, +.spec.ts) | MODIFICADO | Nueva propiedad `layout: 'strip' \| 'grid'` (por defecto `'strip'`), sin duplicar wiring de selección/estado vacío |
| `src/shared/route-map/route-map.element.ts` (+.css, +.spec.ts) | MODIFICADO | Emite `ROUTE_MAP_PHOTO_SELECT_EVENT` al pulsar la miniatura del popup; `cursor:pointer` en CSS |
| `src/shared/models/route.types.ts` | MODIFICADO | `Route.previewPolyline: [number, number][] \| null` |
| `src/shared/models/route.repository.ts` (+.spec.ts) | MODIFICADO | Nuevo método `updatePreviewPolyline()` en `IRouteRepository`; suite de contrato extendida (`registerPreviewPolylineTests`) |
| `src/shared/repositories/memory-route.repository.ts` (+.spec.ts) | MODIFICADO | Implementa `updatePreviewPolyline`; **corrige `save()`** para preservar `previewPolyline` existente en el upsert |
| `src/shared/repositories/sqlite-route.repository.ts` (+.spec.ts) | MODIFICADO | `ensurePreviewPolylineColumn()` (`PRAGMA table_info` + `ALTER TABLE` condicional), `rowToRoute()`/`updatePreviewPolyline` |
| `src/shared/services/route-polyline.service.ts` (+.spec.ts) | CREADO | `simplifyPolyline()` — decimación uniforme, 20-40 puntos, preserva primer/último |
| `src/cockpit/cockpit.service.ts` (+.spec.ts) | MODIFICADO | `persistRouteOnStop()` calcula y persiste `previewPolyline` como sentencia independiente |
| `src/routes/route-list.transform.ts` (+.spec.ts) | CREADO | `buildPolylineSvgPath()` — construcción pura del `d` del `<path>` SVG, Y invertida (norte arriba) |
| `src/routes/route-list-polyline.service.ts` (+.spec.ts) | CREADO | `ensurePreviewPolyline()` — único gatekeeper del backfill perezoso |
| `src/routes/route-list.element.ts` (+.css, +.spec.ts) | MODIFICADO | `.thumb--trace` con SVG si hay `previewPolyline`, backfill sin `await` en caso contrario |
| `vitest.config.ts` | MODIFICADO | Excluye `route-detail.types.ts` de cobertura (tipos puros, mismo criterio que ADR-021) |
| `memory/context.md` | MODIFICADO | Hito documentado honestamente, incluidas verificaciones manuales pendientes |

## 📝 Resumen de Cambios
- Nuevo componente compartido `<tab-bar>`, 100% agnóstico de dominio (cero imports de fotos/rutas), usado para reorganizar `<route-detail>` en 3 pestañas sin recargar fotos/mapa al cambiar.
- `<photo-gallery>` gana un layout `'grid'` (cuadrícula 2/3 columnas) sin tocar `buildThumbnail()` ni el evento `photo-gallery:select` — cero lógica duplicada.
- `<route-map>` emite `route-map:photo-select` desde el popup de un marcador individual; `<route-detail>` decide abrir `<photo-viewer>` — desacoplo real, verificado por ausencia de import.
- Esquema `previewPolyline`/`preview_polyline`: migración segura vía `PRAGMA table_info` + `ALTER TABLE` condicional, con test dedicado que simula una tabla preexistente y verifica que la fila legacy sobrevive intacta.
- Se corrigió un bug real de pérdida de datos en `MemoryRouteRepository.save()` (mismo patrón de ADR-020/ADR-023): el upsert no preservaba `previewPolyline`; el test de regresión falló en RED antes del fix, confirmando el bug.
- Decimación uniforme (`simplifyPolyline`) enganchada en `persistRouteOnStop()` como sentencia `await`-independiente de `save()`, con su propio `.catch()` silencioso.
- Trazado SVG en `<route-list>` con backfill perezoso: `ensurePreviewPolyline()` es el único punto de decisión "ya calculado / hay que calcularlo / no hay datos", con guarda `previewPolyline !== null` (no "no vacío") para no reintentar sobre rutas sin GPS.
- AC-013 (hitbox 56×56 en cuadrícula estrecha) queda honestamente marcada como "CSS-only, no verificada por test unitario" tanto en la spec como en el plan — no se finge cobertura que no existe.

## ✅ Cumplimiento de AC

| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `tab-bar.element.ts` (`buildTabList`) | `tab-bar.element.spec.ts` | hitbox vía `--hitbox-min` en CSS, `data-cy` único |
| AC-002 | ✅ Cumplido | `tab-bar.element.ts` (clase `.tab-bar__panel--active`, nunca se destruye el `<slot>`) | `tab-bar.element.spec.ts` ("does not destroy inactive panels light-DOM nodes...") | Verificado con `===` de nodo, no solo texto |
| AC-003 | ✅ Cumplido | `role="tablist"`/`role="tab"`/`aria-selected`, `<button>` real | `tab-bar.element.spec.ts` | — |
| AC-004 | ✅ Cumplido | Cero imports de dominio en `tab-bar.element.ts` (verificado por lectura directa) | `tab-bar.element.spec.ts` (por construcción) | — |
| AC-005 | ✅ Cumplido | `route-detail.element.ts#buildContent()` | `route-detail.element.spec.ts` | Mapa/cabecera fuera del tab-bar |
| AC-006 | ✅ Cumplido | `buildTabBar()` — "fotos" primero en el array | `route-detail.element.spec.ts` ("mounts a tab-bar...") | `aria-selected="true"` en fotos |
| AC-007 | ✅ Cumplido | `buildEstadisticasPanel()`/`buildNotasPlaceholder()` sin lógica nueva | `route-detail.element.spec.ts` | — |
| AC-008 | ✅ Cumplido | Cambio de pestaña ocurre dentro del shadow DOM de `<tab-bar>`, sin re-render de `route-detail` | `route-detail.element.spec.ts` ("does not refetch...", "does not reinstantiate route-map...") | Spies sobre repos y `mapCtor` |
| AC-009 | ✅ Cumplido | `.photo-gallery--grid` (2 cols mobile-first, 3 cols `min-width:480px`) | `photo-gallery.element.spec.ts` | — |
| AC-010 | ✅ Cumplido | Propiedad `layout`, defecto `'strip'` | `photo-gallery.element.spec.ts` (regresión explícita de cockpit) | Cockpit confirmado sin `layout` asignado |
| AC-011 | ✅ Cumplido | `buildThumbnail()` sin tocar, mismo listener | `photo-gallery.element.spec.ts` / `route-detail.element.ts` mismo listener | Por construcción |
| AC-012 | ✅ Cumplido | Placeholder idéntico en ambos layouts | `photo-gallery.element.spec.ts` | — |
| AC-013 | ⚠️ Parcial (honesto) | CSS `.photo-gallery--grid .photo-thumbnail { min-width/min-height: var(--hitbox-min) }` | Ninguno (documentado explícitamente como no verificable en jsdom) | Correctamente anotado en spec y plan, no se finge cobertura |
| AC-014 | ✅ Cumplido | Popup sin cambios de tamaño/trigger | `route-map.element.spec.ts` (regresión explícita) | — |
| AC-015 | ✅ Cumplido | `img.addEventListener('click', ...)` en `showPhotoPopup` | `route-map.element.spec.ts`, `route-detail.element.spec.ts` | — |
| AC-016 | ✅ Cumplido (sin cambio de código) | `routeMap.photos = this._photos` ya existía | `route-detail.element.spec.ts` ("passes the full list...") | Verificación explícita añadida, no dado por hecho |
| AC-017 | ✅ Cumplido | Cluster nunca invoca `onPhotoClick` (sin tocar) | `route-map.element.spec.ts` ("still calls map.flyTo and does not dispatch...") | Regresión explícita |
| AC-018 | ✅ Cumplido | `<photo-viewer>` montado en `document.body`, sin referencia al mapa | `route-detail.element.spec.ts` ("does not change the map state...") | flyTo/fitBounds count sin cambios |
| AC-019 | ✅ Cumplido | `persistRouteOnStop()` → `simplifyPolyline` + `updatePreviewPolyline` | `cockpit.service.spec.ts` (49+2 puntos GPS reales vía mock de watchPosition) | Verifica primer/último punto real, y caso 0 puntos |
| AC-020 | ✅ Cumplido | `Route.previewPolyline`, `IRouteRepository.updatePreviewPolyline` | `route.repository.spec.ts` (contrato, Memory+Sqlite) | Incluye regresión anti-footgun (ver abajo) |
| AC-021 | ✅ Cumplido | `route-list.element.ts#buildTraceThumb()` vía `buildPolylineSvgPath` | `route-list.element.spec.ts` | `stroke:var(--amber)` en CSS |
| AC-022 | ✅ Cumplido | Placeholder existente si no hay `previewPolyline` | `route-list.element.spec.ts` ("keeps showing the striped placeholder...") | — |
| AC-023 | ✅ Cumplido | `scheduleBackfill()` sin `await` | `route-list.element.spec.ts` ("shows the placeholder on first render, then swaps...") | Verifica no recálculo en 2ª carga |
| AC-024 | ✅ Cumplido | `ensurePreviewPolyline` devuelve `null` sin lanzar si no hay puntos | `route-list-polyline.service.spec.ts`, `route-list.element.spec.ts` | — |
| AC-025 | ✅ Cumplido | `ensurePreviewPolylineColumn()` (`PRAGMA table_info` + `ALTER TABLE` condicional) | `sqlite-route.repository.spec.ts` (mock dedicado, fila legacy preservada) | Ver verificación detallada abajo |
| AC-026 | ✅ Cumplido | — | `tab-bar.element.spec.ts` | — |
| AC-027 | ✅ Cumplido | — | `route-detail.element.spec.ts` | — |
| AC-028 | ✅ Cumplido | — | `photo-gallery.element.spec.ts` (describe "layout property") | — |
| AC-029 | ✅ Cumplido | — | `route-map.element.spec.ts`, `route-detail.element.spec.ts` | `startIndex` verificado con foto en índice 1 de 2 |
| AC-030 | ✅ Cumplido | `simplifyPolyline` | `route-polyline.service.spec.ts` | 500→≤40 puntos, primer/último exacto, <20 sin tocar, 0→`[]` |
| AC-031 | ✅ Cumplido | `ensurePreviewPolyline` | `route-list-polyline.service.spec.ts`, `route-list.element.spec.ts` | `updatePreviewPolyline` llamado exactamente una vez en 2 cargas |
| AC-032 | ✅ Cumplido | `ensurePreviewPolylineColumn()` | `sqlite-route.repository.spec.ts` | Ver verificación detallada abajo |

**32/32 AC marcados; 31 con test automatizado, 1 (AC-013) honestamente documentada como pendiente de verificación visual/Cypress — consistente con lo declarado en la spec y el plan, no una desviación oculta.**

## 🔴 CRÍTICO

### Seguridad
✅ Sin incidencias. No se añaden secretos, dependencias nuevas, ni cambios de CSP/capabilities de Tauri (`git diff` confirma cero cambios en `package.json`, `Cargo.toml`, `tauri.conf.json`, `capabilities/`). El único SQL nuevo (`ALTER TABLE routes ADD COLUMN preview_polyline TEXT;`, `UPDATE routes SET preview_polyline = ? WHERE id = ?`) usa parámetros o una sentencia sin input de usuario — sin concatenación de valores dinámicos.

### Componentes Comunes Afectados
⚠️ Cambios relevantes en `src/shared/`:
- **`tab-bar/` (nuevo)**: agnóstico de dominio confirmado (sin imports de fotos/rutas), reutilizable. Riesgo bajo.
- **`photo-gallery/`**: la propiedad `layout` es aditiva y con valor por defecto que preserva el comportamiento existente en `<cockpit-view>` (confirmado: `cockpit.element.ts` no asigna `layout`, sigue en `'strip'`). Riesgo bajo, con regresión explícita testeada.
- **`route-map/`**: nuevo evento `ROUTE_MAP_PHOTO_SELECT_EVENT`, aditivo, sin romper el contrato existente (`photos`, `points`). Confirmado que `route-map.element.ts`/`.css`/`.spec.ts`/`route-map-photos.ts` no importan `photo-viewer.element.ts` en ningún punto (grep sobre los 4 archivos, un único resultado que es un comentario explicativo, no un import real).
- **Esquema SQLite (`routes`) y `IRouteRepository`**: cambio de contrato compartido por toda la capa de persistencia. Mitigado con: (a) migración `PRAGMA table_info` + `ALTER TABLE` condicional con test dedicado que simula explícitamente una tabla preexistente sin la columna y verifica que la fila legacy sobrevive intacta; (b) fix confirmado del bug de pérdida de datos en `MemoryRouteRepository.save()` (ver detalle en Issues); (c) suite de contrato (`route.repository.spec.ts`) ejercitada contra Memory y Sqlite por igual.

Riesgo controlado: 346 tests (todos verdes), cobertura 94.44% líneas / 88.47% branches (≥80% requerido), y el cambio de esquema sigue explícitamente el patrón ya documentado en ADR-023 (evitando repetir el gap de `PRAGMA foreign_keys`).

### Actualizaciones Core
✅ Ninguna. Sin cambios en TypeScript, Vite, ESLint, Tauri ni ninguna dependencia (`package.json`, `Cargo.toml`, `tauri.conf.json` sin diff).

### Normas Saltadas
✅ Ninguna detectada. `tsc --noEmit`, `eslint src` (con `--max-warnings 0` explícito) y `cargo clippy -- -D warnings`/`cargo fmt --check` pasan sin avisos. El único punto "no verificado por test" (AC-013) está anotado explícitamente como tal en la spec (`specs/features/mejoras-fotos-mapa.md` línea 25) y en el plan (Paso 3), no ocultado ni reclamado como cubierto.

## ⚠️ Issues Encontrados

### ISSUE-001: Verificación visual/Cypress y confirmación en Android real, pendientes — ✅ RESUELTO (2026-07-31)
- **Severidad**: BAJA
- **AC afectado**: AC-013 (hitbox real), y de forma más general la migración `ALTER TABLE` en un dispositivo con SQLite real (no solo el mock `SqlDb`)
- **Descripción**: El plan (`specs/features/mejoras-fotos-mapa.plan.md`, sección "Verificación final") dejaba explícitamente sin marcar: verificación visual de pestañas/cuadrícula/popup/trazado en Cypress o `/run`, y confirmación en dispositivo Android real de que `ALTER TABLE routes ADD COLUMN preview_polyline TEXT` no falla contra una base de datos ya existente con datos reales. `memory/context.md` documentaba esto honestamente como pendiente, coherente con el precedente ya aceptado en ADR-023/`mejoras-usabilidad` (ISSUE-001 de esa spec, resuelto después con verificación real en dispositivo).
- **Resolución**: Confirmado por el usuario — cerrado sin acción adicional pendiente.
- **Recomendación**: Ninguna, issue cerrado.

### ISSUE-002: Sin ADR nuevo para esta feature
- **Severidad**: BAJA (informativo, no bloqueante)
- **Descripción**: `memory/decisions.md` no gana un ADR nuevo para `mejoras-fotos-mapa`, a diferencia de otras specs de tamaño similar. Revisando el contenido, esto es razonable: la feature reutiliza patrones ya decididos (insertar-activa/actualizar-al-parar de ADR-020, migración de columna vía `PRAGMA`+`ALTER TABLE` ya precedida por ADR-023, desacoplo por eventos ya usado por `photo-gallery:select`) sin introducir ninguna decisión de arquitectura nueva que discutir — la API de `<tab-bar>` (slots nombrados) y el algoritmo de decimación uniforme ya estaban "decididos con el usuario" directamente en la spec (sección "Notas de Implementación"), no en el momento de implementar.
- **Recomendación**: Ninguna acción requerida. Si en el futuro se detecta una desviación de diseño no documentada (como pasó con el centroide de `fotos-ruta`, ADR-024), registrarla entonces.

## 📊 Veredicto
- [x] **APPROVED WITH MINOR ISSUES**

Los 32 AC de la spec están implementados y marcados con evidencia de código/test verificable; AC-013 es la única sin test automatizado, pero está documentada honestamente como tal desde la propia spec y el plan (no es un gap oculto). Los dos puntos de mayor riesgo señalados explícitamente en el encargo de esta revisión están genuinamente cubiertos:

1. **`MemoryRouteRepository.save()` y la preservación de `previewPolyline`**: el test de regresión (`route.repository.spec.ts`, "should NOT wipe previewPolyline on a subsequent save() call...") ejercita el flujo real `active` → `updatePreviewPolyline` → `save('completed')` → `getById`, y el plan documenta que este test falló en RED antes del fix — confirmación real del bug, no una suposición.
2. **Migración `PRAGMA table_info` + `ALTER TABLE` de `SqliteRouteRepository`**: cubierta por un mock `SqlDb` dedicado (no el mock compartido, que efectivamente no modela `PRAGMA`) que simula una tabla `routes` preexistente con una fila real, y verifica tanto que el `ALTER TABLE` se ejecuta exactamente una vez cuando falta la columna como que no se ejecuta cuando ya existe, preservando todos los valores de la fila legacy.

`<route-map>` nunca importa `photo-viewer.element.ts` (confirmado por inspección directa de los 4 archivos del directorio `route-map/`), manteniendo el desacoplo por eventos que exige la spec. `<photo-gallery>` con `layout` por defecto (`'strip'`) no afecta al uso existente en `<cockpit-view>` (confirmado: `cockpit.element.ts` no asigna `layout`), y el modo `'grid'` reutiliza `buildThumbnail()`/el evento `photo-gallery:select` sin duplicar lógica.

Quality gates ejecutados directamente (no solo confiando en el auto-reporte del plan): `tsc --noEmit` sin errores, `eslint src --max-warnings 0` sin avisos, `vitest run --coverage` → 346/346 tests verdes, cobertura 94.44%/88.47%/92.41%/94.44% (líneas/branches/funcs/statements, todas ≥80%), `vite build` sin errores, `cargo fmt --check`/`cargo clippy --all-targets -- -D warnings`/`cargo test` limpios (esta feature no toca Rust, y nada más en el repo está roto).

Los dos issues encontrados son de severidad baja y no bloquean el cierre de la feature, pero deben quedar registrados como pendientes explícitos antes de dar por completamente cerrado el ciclo (verificación visual/Cypress + confirmación de la migración en Android real), siguiendo el mismo criterio ya aplicado con éxito en el cierre de `mejoras-usabilidad`.
