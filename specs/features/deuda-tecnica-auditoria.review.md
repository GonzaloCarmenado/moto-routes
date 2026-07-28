# Revisión: Deuda Técnica — Auditoría 2026-07-28

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/utils/geo.ts` | CREADO | `calculateDistance` (Haversine), movida desde `cockpit.transform.ts` (AC-001) |
| `src/shared/utils/geo.spec.ts` | CREADO | Tests movidos de `cockpit.transform.spec.ts` |
| `src/shared/utils/format.ts` | CREADO | `formatDuration`, `calculateAvgSpeed`, movidas desde `cockpit.transform.ts` (AC-001) |
| `src/shared/utils/format.spec.ts` | CREADO | Tests movidos |
| `src/shared/utils/date.ts` | CREADO | `formatRouteDate`, nueva función única de formateo de fecha (AC-003) |
| `src/shared/utils/date.spec.ts` | CREADO | Tests nuevos |
| `src/shared/utils/route-naming.ts` | CREADO | `buildDefaultRouteName` (movida) + `buildRouteDisplayName` (nueva) (AC-003) |
| `src/shared/utils/route-naming.spec.ts` | CREADO | Tests nuevos/movidos |
| `src/cockpit/cockpit.transform.ts` | MODIFICADO | Elimina las 4 funciones movidas; `detectStop` documentado como excepción admitida de import cruzado |
| `src/cockpit/cockpit.transform.spec.ts` | MODIFICADO | Elimina `describe` movidos |
| `src/cockpit/cockpit.service.ts` | MODIFICADO | Imports actualizados a `shared/utils/geo.js`/`format.js` |
| `src/cockpit/cockpit-stop.service.ts` | MODIFICADO | Imports actualizados a `shared/utils/format.js`/`route-naming.js` |
| `src/routes/route-list.element.ts` | MODIFICADO | Usa `formatRouteDate`/`buildRouteDisplayName`/`formatDuration` de `shared/` |
| `src/routes/route-detail.element.ts` | MODIFICADO | Mismo cambio; import de `photo-capture` actualizado a `shared/photo-capture/` |
| `src/routes/route-timeline.transform.ts` | MODIFICADO | `calculateDistance`/`calculateAvgSpeed` desde `shared/`; `detectStop` sigue de `cockpit.transform.ts` con comentario explícito de excepción (AC-001) |
| `src/shared/photo-capture/photo-capture.element.ts` | CREADO | Movido desde `src/photos/` (único cambio real: import de `BaseElement`) |
| `src/shared/photo-capture/photo-capture.element.css` | CREADO | Movido; añade `@import 'tokens.css'`, elimina fallbacks `var(--token, #hex)` (AC-002/AC-004) |
| `src/shared/photo-capture/photo-capture.types.ts` | CREADO | Movido idéntico |
| `src/shared/photo-capture/photo-capture.element.spec.ts` | CREADO | Movido idéntico |
| `src/shared/photo-capture/photo-capture.element.css.spec.ts` | CREADO | Test nuevo AC-004 |
| `src/photos/photo-capture.element.ts` / `.css` / `.types.ts` / `.element.spec.ts` | ELIMINADO | Movidos a `shared/photo-capture/`; carpeta `src/photos/` eliminada (AC-002) |
| `src/cockpit/cockpit.element.ts` | MODIFICADO | Imports de `photo-capture` actualizados a `shared/photo-capture/` |
| `src/components/counter/counter.element.css` | MODIFICADO | Añade `@import 'tokens.css'` (AC-006) |
| `src/components/counter/counter.element.css.spec.ts` | CREADO | Test nuevo AC-006 |
| `src/shared/feedback/confirm-dialog.element.css` | MODIFICADO | Añade `@import 'tokens.css'` (AC-006) |
| `src/shared/feedback/confirm-dialog.element.css.spec.ts` | CREADO | Test nuevo AC-006 |
| `src/shared/styles/tokens.css` | MODIFICADO | Nuevo token `--amber-glow` derivado de la familia OKLCH de `--amber` (AC-007) |
| `src/cockpit/cockpit.element.css` | MODIFICADO | 5 literales `oklch(...)` sustituidos por `var(--amber-glow)` |
| `src/cockpit/cockpit.element.css.spec.ts` | CREADO | Test nuevo AC-007 |
| `src/components/nav-bar/nav-bar.element.css` | MODIFICADO | 1 literal `oklch(...)` sustituido por `var(--amber-glow)` |
| `src/components/nav-bar/nav-bar.element.css.spec.ts` | CREADO | Test nuevo AC-007 |
| `memory/decisions.md` | MODIFICADO | Nuevo ADR-026 (`--amber-glow`, referencia ADR-019) |
| `src-tauri/src/commands/mod.rs` | MODIFICADO | 5 tests `#[cfg(test)]` nuevos para `save_file`/`greet` (AC-008) |
| `src-tauri/src/recording_service.rs` | MODIFICADO | Comentario documentando la ausencia de lógica pura testeable fuera de Android (AC-009) |
| `src/shared/repositories/sqlite-photo.factory.spec.ts` | CREADO | Tests nuevos, 0%→100% cobertura (AC-010) |
| `src/shared/repositories/sqlite-route.factory.spec.ts` | CREADO | Tests nuevos, 73%→100% cobertura (AC-010) |
| `src/shared/services/photo-storage.service.spec.ts` | MODIFICADO | +8 tests: rama Tauri de `createPhotoRepository` (éxito/catch), `buildPhotoMetadata`, mime `.png` (AC-010) |
| `vitest.config.ts` | MODIFICADO | `test: { css: true }` — ajuste no anticipado por el plan, necesario para que `?inline` procese CSS real en tests |
| `memory/context.md` | MODIFICADO | Registro de la sesión, estado del feature y pendientes |

## 📝 Resumen de Cambios

- Refactor de saneamiento técnico puro (8 hallazgos de auditoría), sin funcionalidad nueva salvo dos cambios visuales menores ya decididos por el usuario de antemano (AC-003: unificación de formato de fecha; AC-007: token `--amber-glow`).
- Eliminados los imports cruzados `routes → cockpit` de `formatDuration`/`calculateDistance`/`calculateAvgSpeed`, movidos a `src/shared/utils/`. `detectStop` se mantiene como única excepción documentada explícitamente en ambos extremos del import (`cockpit.transform.ts` y `route-timeline.transform.ts`).
- `photo-capture` reubicado de `src/photos/` a `src/shared/photo-capture/`; la carpeta `src/photos/` ya no existe.
- Deduplicado el nombre por defecto de ruta y el formateo de fecha en `shared/utils/route-naming.ts` y `shared/utils/date.ts`, usados de forma idéntica por `route-list`, `route-detail` y `cockpit`.
- `photo-capture.element.css`, `counter.element.css` y `confirm-dialog.element.css` importan ahora `tokens.css`; eliminados los fallbacks `var(--token, #hex)` de `photo-capture`.
- Nuevo token `--amber-glow` sustituye los 6 literales `oklch(...)` hardcodeados en `cockpit.element.css` (5) y `nav-bar.element.css` (1); documentado en ADR-026, referenciando explícitamente ADR-019.
- `src-tauri/src/commands/mod.rs` gana 5 tests unitarios (`cargo test` pasa de 0 a 5 tests en verde); `recording_service.rs` documenta como limitación conocida la ausencia de lógica pura testeable fuera de Android, sin fabricar tests ficticios.
- Cobertura de wrappers Tauri (`sqlite-photo.factory.ts`, `sqlite-route.factory.ts`, `photo-storage.service.ts`) llevada a 100%/100%/98.82% respectivamente mediante mocks de `@tauri-apps/plugin-sql`, sin dependencias nuevas ni exclusiones nuevas en `vitest.config.ts`.
- Verificado de forma independiente en esta revisión: 481/481 tests TS pasan, cobertura global 95.91%/90.31%/94.48%/95.91% (stmts/branch/funcs/lines), `cargo test` 5/5 en verde, `cargo clippy -- -D warnings` y `cargo fmt --check` sin issues, `tsc --noEmit` sin errores, ESLint sin errores/warnings en los ficheros tocados por esta spec.

## ✅ Cumplimiento de AC

| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `src/shared/utils/geo.ts`, `format.ts`; `cockpit.transform.ts` (excepción `detectStop` documentada); `route-timeline.transform.ts` línea 3-7 | `geo.spec.ts`, `format.spec.ts` | Ningún import cruzado `routes ↔ cockpit` fuera de la excepción de `detectStop`, verificado con grep. Excepción documentada en ambos extremos del import. |
| AC-002 | ✅ Cumplido | `src/shared/photo-capture/*` (movido idéntico salvo import de `BaseElement`) | `photo-capture.element.spec.ts` (movido sin tocar aserciones) | `src/photos/` ya no existe (confirmado). `data-cy` intactos (`photo-add-button`, `photo-menu*`). |
| AC-003 | ✅ Cumplido | `src/shared/utils/date.ts` (`formatRouteDate`), `route-naming.ts` (`buildRouteDisplayName`); usados en `route-list.element.ts`/`route-detail.element.ts` | `date.spec.ts`, `route-naming.spec.ts` | Formato unificado a `month: 'short'` con año siempre, corrige el bug lateral de `route-detail` (título sin año). No verificado visualmente contra datos reales de BBDD (imposible en modo web dev) — decisión explícita del usuario de aceptar por tests + naturaleza mecánica del cambio (ver contexto de la tarea). |
| AC-004 | ✅ Cumplido | `src/shared/photo-capture/photo-capture.element.css` línea 1 (`@import 'tokens.css'`), sin fallbacks | `photo-capture.element.css.spec.ts` | Verificado con grep que no quedan fallbacks `var(--token, ...)`. |
| AC-005 | ✅ Cumplido | Mecanismo global de `tokens.css` (líneas 183-192) reutilizado sin cambios adicionales — sin `@media` local en `photo-capture.element.css` | `photo-capture.element.css.spec.ts` (2 tests nuevos, post-revisión) | Cerrado tras la revisión: se añadió un test que confirma que el CSS resuelto de `photo-capture.element.css` contiene el bloque `@media (prefers-reduced-motion: reduce)` con `animation-duration: 0.01ms !important`, y que el spinner no define ninguna excepción propia. La spec admite explícitamente "test o verificación manual documentada" como vías válidas. Ver ISSUE-001 (resuelto). |
| AC-006 | ✅ Cumplido | `counter.element.css`, `confirm-dialog.element.css` (línea 1, `@import 'tokens.css'`) | `counter.element.css.spec.ts`, `confirm-dialog.element.css.spec.ts` | - |
| AC-007 | ✅ Cumplido | `tokens.css` línea 92 (`--amber-glow`), `cockpit.element.css` (5 sitios), `nav-bar.element.css` (1 sitio) | `cockpit.element.css.spec.ts`, `nav-bar.element.css.spec.ts` | Confirmado con grep: 0 literales `oklch(...)` restantes en `box-shadow`/`text-shadow` de ambos archivos (la única coincidencia de "oklch" restante en `cockpit.element.css` línea 290 es `color-mix(in oklch, var(--bg-bottom)...)`, que usa un token, no un literal — no viola el AC). ADR-026 registrado referenciando ADR-019. Verificación visual confirmada por el usuario según el contexto de la tarea. |
| AC-008 | ✅ Cumplido | `src-tauri/src/commands/mod.rs` líneas 169-238 (`mod tests`) | 5 `#[test]` en el propio archivo | `cargo test` pasa de "0 passed" a 5/5 en verde (confirmado en esta revisión). Los tests cubren el comportamiento real del código (rechaza absoluta, acepta relativa sin `..`, rechaza `..`, rechaza contenido vacío, rechaza nombre vacío en `greet`), no la redacción literal invertida del AC — desviación documentada explícitamente en el plan (gap #1) y en el propio comentario del código. |
| AC-009 | ✅ Cumplido | `src-tauri/src/recording_service.rs` líneas 91-96 (comentario doc antes de `init()`) | N/A (limitación documentada, no test ficticio) | Revisión confirma que toda la lógica no trivial del archivo está `#[cfg(target_os = "android")]`; la conclusión de "no hay nada testeable fuera de Android sin un runtime Tauri real" es razonable. |
| AC-010 | ✅ Cumplido | `sqlite-photo.factory.ts` (100%/100%/100%/100%), `sqlite-route.factory.ts` (100%/100%/100%/100%), `photo-storage.service.ts` (98.82%/93.93%/100%/98.82%) | `sqlite-photo.factory.spec.ts`, `sqlite-route.factory.spec.ts`, `photo-storage.service.spec.ts` (extendido) | Umbral global 80% superado ampliamente (95.91%/90.31%/94.48%/95.91%). Sin exclusiones nuevas en `vitest.config.ts` (confirmado leyendo el archivo). Sin dependencias nuevas (mocks de `@tauri-apps/plugin-sql` vía `vi.mock`). |

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias. No se han introducido secretos, tokens ni credenciales. Los tests de `save_file` en Rust refuerzan (no debilitan) la validación de path traversal ya existente. No hay cambios de CSP.

### Componentes Comunes Afectados
- ⚠️ **`src/shared/` recibe cambios sustanciales** (AC-001, AC-002, AC-003), como ya anticipaba la propia spec (Constraints: "Los cambios en `src/shared/` se marcan como CRÍTICO"):
  - `src/shared/utils/geo.ts`, `format.ts`, `date.ts`, `route-naming.ts` — nuevas funciones puras consumidas por `cockpit` y `routes`. Revisadas: implementación idéntica a la movida, con tests trasladados sin relajar aserciones. Sin riesgo detectado.
  - `src/shared/photo-capture/` — nuevo directorio, consumido por `cockpit.element.ts` y `route-detail.element.ts`. El único cambio real de código fue el import de `BaseElement` (`'../shared/base-element.js'` → `'../base-element.js'`); confirmado con lectura línea a línea que el resto del archivo es idéntico. `data-cy` intactos.
  - `src/shared/styles/tokens.css` — nuevo token `--amber-glow`, aditivo, no modifica ningún token existente. Impacto en toda la app: nulo salvo en los 6 sitios que ahora lo consumen explícitamente.
  - Ninguno de estos cambios rompe ningún test existente (481/481 en verde) ni introduce regresiones detectables en esta revisión.

### Actualizaciones Core
- ⚠️ `vitest.config.ts`: se añade `test: { css: true }`. Es un ajuste de configuración de testing (no una dependencia nueva), necesario para que los tests `*.element.css.spec.ts` (`?inline`) reciban el CSS real resuelto por Vite en vez de una cadena vacía. Justificado y documentado explícitamente en el plan y en `memory/context.md`. No afecta al build de producción, solo al entorno de test. Sin impacto detectado en el resto de la suite (todos los tests siguen en verde).
- ✅ Ninguna dependencia de `package.json`/`Cargo.toml`/`src-tauri/Cargo.toml` añadida o modificada (confirmado con `git status`/`git diff`).

### Normas Saltadas
- ✅ Ninguna detectada sin justificar. La única desviación de redacción literal (AC-008, tests contra el comportamiento real del código en vez de la redacción invertida del AC) está documentada explícitamente como gap conocido en el plan y como comentario en el propio código fuente — no es una norma saltada en silencio.

## ⚠️ Issues Encontrados

### ISSUE-001: AC-005 (spinner y `prefers-reduced-motion`) sin verificación manual documentada
- **Severidad**: BAJA
- **AC afectado**: AC-005
- **Descripción**: El propio plan reconoce que este AC "no es automatizable de forma fiable con jsdom" y exige una verificación manual (DevTools → "Emulate CSS prefers-reduced-motion: reduce" sobre `<photo-capture class="is-loading">`) documentada como captura o nota en el PR. No se ha encontrado ningún rastro de esa verificación en `memory/context.md`, `memory/decisions.md` ni en ningún otro artefacto del repo. El mecanismo en sí (bloque global `@media (prefers-reduced-motion: reduce)` en `tokens.css`, ya usado por `pulse-dot` en `cockpit.element.css`) es sólido y de bajo riesgo por ser un patrón ya probado en producción, pero el AC tal como está redactado en la spec pide una verificación explícita que no consta como realizada.
- **Recomendación**: Antes de cerrar definitivamente el feature, hacer la comprobación manual descrita (build dev + DevTools) y dejar una nota en `memory/context.md` o en la propia spec confirmando el resultado — mismo criterio ya aplicado a AC-003/AC-007, que sí quedan marcados explícitamente como "pendiente de verificación visual" en `memory/context.md`. Alternativamente, si el usuario da por bueno el mecanismo sin captura adicional (como ya hizo con AC-003), dejar esa decisión registrada explícitamente igual que se hizo para AC-003.
- **Resuelto (2026-07-28, sesión posterior)**: en vez de la verificación manual en DevTools (frágil de automatizar de forma fiable — requiere pilotar el panel Rendering por clics), se añadió `photo-capture.element.css.spec.ts` con 2 tests que confirman deterministamente que el override global de `tokens.css` llega al CSS resuelto del componente. 483/483 tests TS en verde tras el cambio. La spec admite esta vía explícitamente ("verificable mediante test o verificación manual documentada"), así que se considera AC-005 cumplido sin necesidad de captura adicional.

## 📊 Veredicto
- [x] APPROVED (tras resolución de ISSUE-001 en sesión posterior)

Los 10 AC están correctamente implementados y verificados de forma independiente en esta revisión (tests, cobertura, compilación, linters, greps de imports cruzados y residuos). No hay gaps de implementación, desviaciones no justificadas ni problemas de seguridad. El único issue encontrado (ISSUE-001, severidad BAJA) — falta de verificación documentada de AC-005 — quedó resuelto con un test automatizado añadido tras esta revisión.
