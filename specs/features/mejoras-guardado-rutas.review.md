# Revisión: Mejoras de Guardado y Gestión de Rutas

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/models/route.types.ts` | MODIFICADO | `Route` gana `name: string \| null` y `notes: string \| null`; `CreateRoute` gana `name?: string` (opcional, decisión de diseño #3 del plan) |
| `src/shared/models/route.repository.ts` | MODIFICADO | `IRouteRepository` gana `updateNotes(routeId, notes: string \| null): Promise<void>` |
| `src/shared/models/route.repository.spec.ts` | MODIFICADO | `registerNameAndNotesTests()` nuevo, registrado en `createRouteSuite` (corre contra Memory y Sqlite) |
| `src/shared/repositories/memory-route.repository.ts` | MODIFICADO | `save()` coalesce `name`/`notes` con el valor existente; nuevo `updateNotes()` |
| `src/shared/repositories/sqlite-route.repository.ts` | MODIFICADO | `ensureColumn()` genérico (reemplaza el caso particular de `preview_polyline` como patrón, sin tocar `ensurePreviewPolylineColumn` en sí) para migrar `name`/`notes` vía `ALTER TABLE` bajo demanda; `save()`/`rowToRoute()`/`RouteRow` incluyen ambos campos; nuevo `updateNotes()` |
| `src/shared/repositories/sqlite-route.repository.spec.ts` | MODIFICADO | Tests de migración `name`/`notes` (columnas ausentes/presentes, fila preexistente intacta), helpers de mock (`insertRoute`/`updateRoute`/`updateNotes`) actualizados |
| `src/cockpit/cockpit.transform.ts` | MODIFICADO | `sanitizeRouteName()` (trim + límite 100) y `buildDefaultRouteName()` (formato `"Ruta {fecha}, {hora}"`) |
| `src/cockpit/cockpit.transform.spec.ts` | MODIFICADO | Tests de las dos funciones anteriores |
| `src/cockpit/cockpit-save-route-dialog.element.ts` | CREADO | Diálogo propio del dominio `cockpit`, réplica deliberada del focus-trap/overlay de `<confirm-dialog>` (no lo amplía) — ver ADR-025 |
| `src/cockpit/cockpit-save-route-dialog.element.css` | CREADO | Estilos vía tokens (`--panel`, `--line`, `--ink`, `--amber`, `--hitbox-min`, etc.), sin hardcodear |
| `src/cockpit/cockpit-save-route-dialog.element.spec.ts` | CREADO | 7 tests: montaje/foco, resolución save/discard, `maxlength=100`, no cierre con Escape/overlay, ciclo de foco Tab/Shift+Tab |
| `src/cockpit/cockpit-persist.service.ts` | MODIFICADO | `buildCreateRoute`/`persistRouteOnStop` reciben `name` y lo incluyen en el `CreateRoute` persistido |
| `src/cockpit/cockpit.service.ts` | MODIFICADO | `confirmSaveRecording(name: string)` (antes sin parámetros); `confirmSaveRecordingAction` propaga `name` |
| `src/cockpit/cockpit.service.spec.ts` | MODIFICADO | ~9 call-sites actualizados + 2 tests nuevos (persistencia con nombre AC-004, fila `active` con `name: null`) |
| `src/cockpit/cockpit-stop.service.ts` | MODIFICADO | `decideStopOutcome()` sustituye `confirmDialog()` por `openSaveRouteDialog()`; calcula `finalName` (saneado o por defecto) antes de llamar a `confirmSaveRecording` |
| `src/cockpit/cockpit-stop.service.spec.ts` | MODIFICADO | 3 tests existentes migrados al nuevo diálogo + 4 tests nuevos (nombre saneado, fallback por defecto, descarte no filtra nombre AC-008, truncado a 100 AC-009) |
| `src/cockpit/cockpit.element.spec.ts` | MODIFICADO | `getConfirmDialog()` → `getSaveRouteDialog()`, selectores actualizados en los 4 tests de guardar/descartar/Escape/overlay |
| `src/routes/route-list.element.ts` | MODIFICADO | `buildCard()` usa `route.name` con fallback a "Ruta {fecha}" |
| `src/routes/route-list.element.spec.ts` | MODIFICADO | 2 tests nuevos (nombre persistido AC-005, fallback AC-007) |
| `src/routes/route-detail.element.ts` | MODIFICADO | `buildHeader()` usa `route.name` con mismo fallback; `buildNotasPlaceholder()` eliminado, sustituido por `buildNotasPanel`/`handleSaveNote` importados de `route-detail-notes.ts` |
| `src/routes/route-detail.element.css` | MODIFICADO | `.note-text` sustituido por `.notes-textarea`/`.notes-save-btn`, vía tokens |
| `src/routes/route-detail.element.spec.ts` | MODIFICADO | 2 tests de nombre (AC-006/AC-007) + 8 tests de editor de notas (AC-010 a AC-017) + eliminación del test obsoleto de placeholder estático |
| `src/routes/route-detail-notes.ts` | CREADO | `saveRouteNote()` (persistencia + toast) y `buildNotasPanel()` (DOM), extraído para no superar el límite de tamaño de `route-detail.element.ts` |
| `src/components/nav-bar/nav-bar.element.css` | MODIFICADO | `.nav-item--record` pasa de posicionamiento absoluto (`top: 20px`) a `display: grid` con `::before`/`.record-dot` en la misma `grid-area` — fix estructural, sin tocar DOM |
| `src/components/nav-bar/nav-bar.element.spec.ts` | MODIFICADO | 2 tests nuevos: DOM sin cambios, y guard de regresión sobre el CSS fuente (sin `top:` numérico, misma `grid-area`) |
| `src/routes/route-list-polyline.service.spec.ts` | MODIFICADO | Ajuste mecánico de fixtures (`name`/`notes` en literales `Route`), sin cambio de comportamiento |
| `memory/context.md`, `memory/decisions.md` | MODIFICADO | Entrada de sesión + ADR-025 (diálogo propio en vez de ampliar `<confirm-dialog>`) |
| `specs/features/mejoras-guardado-rutas.md`, `.plan.md` | NUEVO (sin trackear) | Spec y plan de esta feature |

No se ha tocado `src-tauri` en esta ronda (feature puramente frontend/TS).

## 📝 Resumen de Cambios

- Se añade nombre de ruta (personalizado o por defecto fecha/hora) al guardar, persistido en columna `name` nueva de SQLite vía migración `ALTER TABLE` bajo demanda, generalizando el patrón ya usado para `preview_polyline` (`ensureColumn()`).
- Se añade un editor de notas de texto libre en la pestaña "Notas" de `<route-detail>`, persistido en columna `notes` nueva con la misma estrategia de migración, con guardado explícito, carga automática y manejo de error sin pérdida del texto escrito.
- Se corrige el defecto visual del punto descentrado del botón "Grabar" de la nav-bar con un fix estructural (CSS Grid) en vez de un ajuste numérico a ojo.
- Se crea `cockpit-save-route-dialog` como componente nuevo y aislado en `src/cockpit/`, sin tocar `<confirm-dialog>` compartido ni sus 3 consumidores existentes — decisión registrada en ADR-025.

## ✅ Cumplimiento de AC

| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `cockpit-save-route-dialog.element.ts`, wiring en `cockpit-stop.service.ts` | `cockpit-save-route-dialog.element.spec.ts` (montaje+foco), `cockpit.element.spec.ts` (E2E long-press real) | - |
| AC-002 | ✅ Cumplido | `buildDefaultRouteName()` en `cockpit.transform.ts`, usado en `decideStopOutcome()` | `cockpit.transform.spec.ts`, `cockpit-stop.service.spec.ts` ("falls back to a date/time-based default name") | Usa `metadata.date` (momento de parada), tal como decide el plan #5 |
| AC-003 | ✅ Cumplido | `sanitizeRouteName()` (trim) | `cockpit.transform.spec.ts`, `cockpit-save-route-dialog.element.spec.ts` (sin trim, responsabilidad del llamador), `cockpit-stop.service.spec.ts` (trim de extremo a extremo) | Separación limpia: el diálogo no saniza, el orquestador sí |
| AC-004 | ✅ Cumplido | `sqlite-route.repository.ts` (`ensureColumn('name','TEXT')`, INSERT/UPDATE), `memory-route.repository.ts` | `route.repository.spec.ts` (`registerNameAndNotesTests`, contrato Memory+Sqlite), `cockpit.service.spec.ts` (AC-004 específico) | - |
| AC-005 | ✅ Cumplido | `route-list.element.ts` `buildCard()` | `route-list.element.spec.ts` | - |
| AC-006 | ✅ Cumplido | `route-detail.element.ts` `buildHeader()` | `route-detail.element.spec.ts` | - |
| AC-007 | ✅ Cumplido | Fallback `route.name?.trim() ? ... : 'Ruta ' + fecha` en ambos componentes; migración deja `name: null` en filas preexistentes | `route-list.element.spec.ts`, `route-detail.element.spec.ts`, `sqlite-route.repository.spec.ts` (migración con fila legacy intacta), `cockpit.service.spec.ts` (fila `active` con `name: null`) | Cubierto tanto a nivel de UI como de migración real de BBDD |
| AC-008 | ✅ Cumplido | `resolveStopDecision`: en rama `discard` nunca se llama a `confirmSaveRecording` | `cockpit-stop.service.spec.ts` ("does not persist the route nor call confirmSaveRecording... AC-008"), `cockpit-save-route-dialog.element.spec.ts` | - |
| AC-009 | ✅ Cumplido | `maxlength="100"` en el input + `sanitizeRouteName()` trunca a 100 | `cockpit-save-route-dialog.element.spec.ts` (atributo), `cockpit.transform.spec.ts` (truncado), `cockpit-stop.service.spec.ts` (truncado de extremo a extremo) | Doble defensa (HTML + lógica), correcto |
| AC-010 | ✅ Cumplido | `route-detail-notes.ts` `buildNotasPanel()` sustituye `buildNotasPlaceholder()` | `route-detail.element.spec.ts` ("persists the typed text via updateNotes...") | Test del placeholder estático eliminado correctamente |
| AC-011 | ✅ Cumplido | Botón "Guardar nota" con `handleSaveNote` | `route-detail.element.spec.ts` | - |
| AC-012 | ✅ Cumplido | `saveRouteNote()` llama a `showToast('Nota guardada', 'success')` (módulo compartido `shared/feedback/toast.ts`) | `route-detail.element.spec.ts` | - |
| AC-013 | ✅ Cumplido | `buildNotasPanel(route, ...)` inicializa `textarea.value = route.notes ?? ''` con el dato ya cargado en `fetchAndRender()` | `route-detail.element.spec.ts` (carga inicial + edición) | - |
| AC-014 | ✅ Cumplido | `placeholder` fijo `'Escribe aquí tus notas sobre la ruta…'` | `route-detail.element.spec.ts` | - |
| AC-015 | ✅ Cumplido | Columna `notes TEXT` vía `ensureColumn()`, mismo patrón que `name` | `route.repository.spec.ts`, `sqlite-route.repository.spec.ts` | - |
| AC-016 | ✅ Cumplido | `saveRouteNote()`: `textarea.value.trim() === '' ? null : ...`, sin `confirmDialog` | `route-detail.element.spec.ts` ("persists notes as null... without any confirmation dialog"), `route.repository.spec.ts` | - |
| AC-017 | ✅ Cumplido | `catch` en `saveRouteNote()` muestra toast de error y no toca el `<textarea>` | `route-detail.element.spec.ts` ("shows an error toast and keeps the typed text...") | - |
| AC-018 | ✅ Cumplido | `nav-bar.element.css`: `.nav-item--record` → `display: grid`, `::before`/`.record-dot` comparten `grid-area: circle` | `nav-bar.element.spec.ts` (guard de regresión sobre CSS fuente + DOM sin cambios) | Verificación visual real (jsdom no calcula layout) queda pendiente, tal como el propio plan anticipa en su nota final del Paso 11 — no es un gap, es una limitación conocida y documentada |

18/18 AC cumplidos. Todos con al menos un test que cubre el escenario Dado/Cuando/Entonces relevante; los de mayor riesgo (migración SQLite, flujo de guardar/descartar de extremo a extremo, error de guardado de nota) tienen cobertura tanto unitaria como de integración dentro de la suite Vitest.

## 🔴 CRÍTICO

### Seguridad
✅ Sin incidencias. No se introducen secretos ni tokens. El input de nombre de ruta lleva `maxlength="100"` en el HTML y `sanitizeRouteName()` trunca también en la capa de orquestación (defensa en profundidad); no hay riesgo de inyección SQL porque tanto `name` como `notes` viajan como parámetros posicionados (`?`) en `db.execute(...)`, nunca interpolados en el string SQL. El CSP no se ha tocado.

### Componentes Comunes Afectados
✅ **Ninguno de forma real.** Verificado con `git diff --stat` sobre `src/shared/feedback/confirm-dialog.element.ts`/`.css`/`.spec.ts`: **sin cambios, diff vacío**. El plan proponía explícitamente no ampliar `<confirm-dialog>` (decisión de diseño #1) precisamente para evitar tocar un componente compartido con 3 consumidores y ese compromiso se cumplió al pie de la letra — `cockpit-save-route-dialog` es un componente nuevo y aislado en `src/cockpit/`, único consumidor. La decisión está documentada en ADR-025 con alternativas consideradas y consecuencias (duplicación deliberada del fragmento de focus-trap, aceptada como compromiso).

Sí se modifican dos ficheros que técnicamente son "compartidos" en el sentido de repositorio de dominio (`route.types.ts`, `route.repository.ts`, `memory-route.repository.ts`, `sqlite-route.repository.ts`) pero son extensiones aditivas y no rompen ningún contrato existente: `name` es opcional en `CreateRoute`, `updateNotes()` es un método nuevo, y todo el código previo que ya usaba `Route`/`CreateRoute` sigue compilando sin cambios (verificado: `tsc --noEmit` sin errores en todo el proyecto).

### Migración SQLite (`ALTER TABLE`)
⚠️ Revisado con atención por ser un punto de riesgo real (dato de producción en dispositivos ya instalados). El patrón sigue exactamente `ensurePreviewPolylineColumn()` (ADR-020): `PRAGMA table_info(routes)` se consulta antes de cada `ALTER TABLE`, generalizado en `ensureColumn(name, sqlType)`. Se verificó:
- Test `'runs ALTER TABLE exactly once for name and once for notes when both are missing... keeping the existing row intact'` — confirma que una fila preexistente (`legacy-route-1`) sobrevive la migración con `name: null`/`notes: null`, sin excepción.
- Test `'does not run ALTER TABLE for name/notes when both already exist'` — evita migraciones redundantes en cada arranque.
- No hay ningún `DROP TABLE`/`CREATE TABLE` que recree `routes` — solo `ADD COLUMN`, coherente con el constraint explícito de la spec ("nunca se recrea la tabla ni se pierden filas existentes").

Como ya ocurrió con `preview_polyline` (ISSUE-001 de `mejoras-fotos-mapa.review.md`), la verificación de esta migración contra una BBDD SQLite real en dispositivo Android (no solo el mock `SqlDb` de los tests) queda como pendiente de verificación manual — es una limitación conocida del enfoque de testing de este proyecto, no un gap introducido por esta feature.

### Actualizaciones Core
✅ Ninguna. No se ha tocado `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `package.json` (dependencias), `Cargo.toml`, ni `tauri.conf.json`.

### Normas Saltadas
✅ Ninguna detectada. TDD respetado (tests actualizados junto con cada paso del plan), tipos estrictos (`tsc --noEmit` sin errores), estructura de carpetas por dominio (`cockpit-save-route-dialog` en `cockpit/`, `route-detail-notes.ts` en `routes/`), separación `.element.ts`/`.element.css`/spec mantenida, CSS sin valores hardcodeados (tokens en ambos ficheros CSS nuevos/modificados), `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` en todos los elementos interactivos nuevos.

## ⚠️ Issues Encontrados

Ninguno bloqueante. Un único punto menor, ya anticipado y documentado por el propio plan:

### ISSUE-001: Verificación visual real del centrado del punto (AC-018) pendiente
- **Severidad**: BAJA
- **AC afectado**: AC-018
- **Descripción**: El fix es CSS puro (Grid), correcto sobre el papel y cubierto por un test de guardia sobre el CSS fuente, pero jsdom no calcula layout/geometría real — no hay confirmación visual (captura Cypress o build) de que el punto se perciba centrado en un navegador/dispositivo real.
- **Recomendación**: Comprobación visual rápida en `pnpm run dev` (web, sin necesidad de build Android completo, tal como ya señala la nota del Paso 11 del plan) antes de dar por cerrado el feature a nivel de producto.

## 📊 Veredicto

- [x] **APPROVED**

Verificación de primera mano realizada en esta revisión (no solo confianza en el resumen del impl-agent):
- `pnpm exec vitest run`: **391/391 tests pasan**, 0 fallos.
- Cobertura calculada desde `coverage/coverage-final.json`: **94.89% statements, 93.12% functions, 89.30% branches** — por encima del gate del 80% documentado en `CLAUDE.md`.
- `pnpm exec tsc --noEmit`: sin errores.
- `pnpm run lint` (`eslint src/`): 0 errores/warnings en todos los ficheros bajo `src/` tocados por esta feature. Los 2 `fatalError` que aparecen (`eslint.config.js`, `tests/setup.ts`, "not found by the project service") son preexistentes y no relacionados — confirmado reproduciéndolos con `git stash` antes de aplicar los cambios de esta feature.
- `pnpm exec vite build`: build exitoso (el único warning es sobre tamaño de chunk, preexistente y no relacionado con esta feature).
- Confirmado con `git diff --stat` que `<confirm-dialog>` (componente compartido) tiene **cero cambios**, tal como prometía el plan.

18/18 AC implementados, con test que cubre el escenario Dado/Cuando/Entonces de cada uno. Sin gaps, sin desviaciones no documentadas, sin hallazgos de seguridad, sin normas saltadas. El único punto abierto (verificación visual real de AC-018) es de severidad baja y ya estaba anticipado como pendiente por el propio plan, no bloquea el cierre del feature.

## Refinamiento post-review: modo vista/edición de notas (AC-019, mismo día)

Tras el APPROVED, el usuario pidió un ajuste de UX antes de probar en dispositivo: si una ruta ya tiene nota, mostrarla en **modo vista** (texto integrado, sin caja ni borde de campo de texto) con un icono de lápiz arriba a la derecha para pasar a edición — en vez de mostrar siempre el `<textarea>` editable directamente.

- Se añade **AC-019** a la spec y se reescriben las AC-013/014 y los escenarios "Editar una nota"/"Borrar el contenido de una nota" para reflejarlo.
- `route-detail-notes.ts`: `buildNotasPanel` arranca en modo vista si `route.notes` no está vacío, o en modo edición si lo está (AC-014, sin nada que ver). El icono de editar reconstruye el panel en modo edición con el texto precargado. `saveRouteNote` ahora devuelve `Promise<boolean>` (antes `Promise<void>`) para que el panel sepa si debe volver a modo vista tras guardar — en error (AC-017) el DOM no se toca, conservando el texto escrito.
- `route-detail.element.css`: nuevas reglas `.notes-view`/`.notes-view-text`/`.notes-edit-btn` (icono `position: absolute; top/right`, mismo patrón que el botón de cerrar de `photo-viewer.element.css`), vía tokens, con hitbox `--hitbox-min`.
- 4 tests de `route-detail.element.spec.ts` actualizados (los que asumían el textarea visible directamente con una nota preexistente ahora pulsan el icono de editar primero) + 2 tests nuevos para el modo vista y el cambio a edición. 392/392 tests, cobertura 94.94%.
- Recompilado (`pnpm tauri android build`) e instalado en dispositivo real para que el usuario lo revise visualmente (junto con el ISSUE-001 de AC-018 pendiente de arriba).
