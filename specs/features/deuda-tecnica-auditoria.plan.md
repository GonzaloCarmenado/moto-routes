# Plan de Implementación: Deuda Técnica — Auditoría 2026-07-28

> **Estado: Completado (2026-07-28)** — los 9 pasos implementados con TDD, AC-001 a AC-010 marcados `[x]` en la spec. 481/481 tests TS pasan, cobertura global 95.9%/90.31%/94.48%/95.9% (stmts/branch/funcs/lines). `cargo test`/`cargo clippy -- -D warnings`/`cargo fmt --check` en verde (5 tests nuevos en `src-tauri/`). Un ajuste no anticipado por el plan: hubo que añadir `test: { css: true }` a `vitest.config.ts` (los tests de `*.element.css.spec.ts` de los Pasos 4/5/6 comprobaban contenido real de CSS vía `?inline`, pero Vitest devuelve `''` para todo import CSS por defecto) y las aserciones de esos specs se adaptaron para comprobar contenido *resuelto* de `tokens.css` (p. ej. `--amber:`) en vez del texto literal `@import`/`tokens.css`, que Vite reemplaza en línea al procesar `?inline`. Ver detalle en cada paso. Pendiente de verificación visual manual por el usuario (capturas antes/después) del cambio de AC-007 (`--amber-glow`) y AC-003 (formato de fecha unificado) antes de considerar el feature cerrado — recomendado invocar `review-agent` a continuación.

> Spec de refactor/saneamiento (sin cambio de comportamiento observable, salvo AC-007 y la unificación de formato de fecha de AC-003, ambas acotadas explícitamente). Orden de ejecución pensado para minimizar "blast radius": primero los movimientos de archivo que tocan 3+ dominios (AC-001, AC-002), verificando la suite en verde tras cada uno; después la deduplicación (AC-003); después CSS/tokens, aislado y de bajo riesgo (AC-004 a AC-007); después Rust (AC-008/AC-009); y por último la cobertura de wrappers Tauri (AC-010), la más laboriosa por el mockeo.

## ⚠️ Gaps detectados que requieren aclaración antes/durante la implementación (no resueltos por este plan)

1. **AC-008, posible inversión de redacción**: el texto de la spec pide tests para "`save_file` con una ruta absoluta válida (**éxito**)" y "`save_file` con una ruta relativa (**rechazado**)". El código real de `src-tauri/src/commands/mod.rs` hace exactamente lo contrario: `if path.is_absolute() { return Err(...) }` — rechaza absolutas, exige relativas sin `..`. Como esta spec es de refactor/tests (no cambia comportamiento, ver invariante global), el Paso 7 de este plan escribe los tests contra el **comportamiento real del código** (rechaza absoluta, acepta relativa sin `..`, rechaza `..`), no contra la redacción literal del AC. Recomendación: pedir a spec-agent que corrija el texto de AC-008 (intercambiar "absoluta"/"relativa") para que quede alineado con el código, salvo que el usuario confirme que en realidad quiere invertir la validación real — eso sí sería un cambio de comportamiento y necesitaría un ADR propio, fuera del alcance de "refactor sin cambio de comportamiento" que declara esta spec.
2. **AC-007, valor exacto de `--amber-glow`**: los 6 literales `oklch(...)` no comparten el mismo valor (varían entre `oklch(60% 0.17 45 / 0.4)`, `oklch(70% 0.17 45 / 0.8)`, `oklch(70% 0.17 45 / 0.35)` y `oklch(60% 0.17 45 / 0.45)` ×2). Un único token no puede reproducir bit a bit las 4 combinaciones de lightness/alpha sin sintaxis de color relativo (`oklch(from var(...) ...)`), que añade riesgo de soporte en WebView Android. El Paso 6 propone `--amber-glow: oklch(60% 0.17 45 / 0.45)` (valor ya usado en 2 de los 6 sitios) como consolidación única, aceptando una variación menor de intensidad en los otros 4 (más marcada en el `chip__dot`, que pasa de alpha 0.8 a 0.45). Esto es coherente con "se mantiene el efecto visual" en términos generales, no exactos — impl-agent debe enseñar una captura al usuario antes de dar el cambio por bueno, igual que ya pedía la spec para la decisión de diseño original de AC-007.
3. **AC-003, formato de mes elegido**: la spec deja abierto qué formato de mes unificar (`short` vs `long`), solo exige que sea el mismo en los 3 puntos. El Paso 3 elige `month: 'short'` (ya usado hoy en `route-list` y en `buildDefaultRouteName`, más compacto para pantallas de moto). Esto cambia visualmente `route-detail` (hoy `long`) y además corrige un bug lateral: el título de `route-detail` (línea ~223) hoy construye la fecha **sin `year`**, mientras que su párrafo de fecha (línea ~228) sí lo lleva — tras la unificación ambos usan la misma función y llevan año siempre.

---

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Mover funciones puras de cockpit a `shared/utils/` | `shared/utils/geo.ts`, `shared/utils/format.ts` (+specs), `cockpit.transform.ts`(+spec), `cockpit.service.ts`, `cockpit-stop.service.ts`, `route-list.element.ts`, `route-detail.element.ts`, `route-timeline.transform.ts` | AC-001 | Large |
| 2 | Mover `photo-capture` a `shared/photo-capture/` | `shared/photo-capture/*` (nuevo), `src/photos/*` (eliminado), `cockpit.element.ts`, `route-detail.element.ts` | AC-002 | Large |
| 3 | Deduplicar nombre por defecto y formateo de fecha | `shared/utils/date.ts`, `shared/utils/route-naming.ts` (+specs), `cockpit.transform.ts`(+spec), `cockpit-stop.service.ts`, `route-list.element.ts`, `route-detail.element.ts` | AC-003 | Large |
| 4 | `photo-capture.element.css`: tokens + reduced motion | `shared/photo-capture/photo-capture.element.css` (+ nuevo spec) | AC-004, AC-005 | Small |
| 5 | Importar `tokens.css` en `counter`/`confirm-dialog` | `counter.element.css`, `confirm-dialog.element.css` (+ 2 specs nuevos) | AC-006 | Medium |
| 6 | Token `--amber-glow` + ADR | `tokens.css`, `cockpit.element.css`, `nav-bar.element.css` (+ 2 specs nuevos), `memory/decisions.md` | AC-007 | Medium |
| 7 | Tests Rust de `commands/mod.rs` | `src-tauri/src/commands/mod.rs` | AC-008 | Small |
| 8 | Revisión/documentación de `recording_service.rs` | `src-tauri/src/recording_service.rs` | AC-009 | Small |
| 9 | Cobertura de wrappers Tauri (factories + photo-storage) | `sqlite-photo.factory.spec.ts` (nuevo), `sqlite-route.factory.spec.ts` (nuevo), `photo-storage.service.spec.ts` | AC-010 | Small (mocking laborioso pese al recuento de archivos) |

---

## Paso 1: Mover `formatDuration`, `calculateDistance`, `calculateAvgSpeed` a `src/shared/utils/`

- **Objetivo**: Ningún archivo de `src/routes/` importa de `src/cockpit/cockpit.transform.ts`; los 3 dominios (`cockpit`, `routes`) consumen estas 3 funciones puras exclusivamente desde `src/shared/`. `detectStop` permanece en `cockpit.transform.ts` como única excepción documentada.
- **AC cubiertos**: AC-001
- **Tests a escribir (antes de tocar `cockpit.transform.ts`)**:
  - `shared/utils/geo.spec.ts`: mover tal cual las 3 `it()` de `calculateDistance` que hoy están en `cockpit.transform.spec.ts` (mismo punto, Madrid-Barcelona, distancia pequeña) → Valida AC-001.
  - `shared/utils/format.spec.ts`: mover las `it()` de `formatDuration` (MM:SS y HH:MM:SS) y `calculateAvgSpeed` (incl. caso `timeSeconds <= 0` → 0) que hoy están en `cockpit.transform.spec.ts` → Valida AC-001.
  - Estos specs deben fallar en rojo primero (import de un archivo que no existe todavía) antes de crear `geo.ts`/`format.ts`.
- **Archivos a crear/modificar**:
  - `CREAR src/shared/utils/geo.spec.ts`
  - `CREAR src/shared/utils/geo.ts` (`calculateDistance` + `toRadians`/`EARTH_RADIUS_KM` privados, movidos literalmente)
  - `CREAR src/shared/utils/format.spec.ts`
  - `CREAR src/shared/utils/format.ts` (`formatDuration` + `calculateAvgSpeed`, movidos literalmente)
  - `MODIFICAR src/cockpit/cockpit.transform.ts`: elimina las 3 definiciones movidas; importa `formatDuration` de `../shared/utils/format.js` (lo sigue necesitando internamente para `getCockpitDisplayValues`); `formatSpeed`, `detectStop`, `sanitizeRouteName`, `buildDefaultRouteName` (este último se toca de nuevo en el Paso 3, no antes), `getCockpitDisplayValues`, `getStatusChipClass/Label` se quedan igual. Añadir comentario junto a `detectStop` documentando que es la única función de este archivo que sigue siendo importada desde fuera de `cockpit/` (por `route-timeline.transform.ts`), como excepción admitida (AC-001).
  - `MODIFICAR src/cockpit/cockpit.transform.spec.ts`: elimina los `describe('calculateDistance')`/`describe('formatDuration')`/`describe('calculateAvgSpeed')` movidos; mantiene el resto.
  - `MODIFICAR src/cockpit/cockpit.service.ts`: `import { calculateDistance, calculateAvgSpeed } from '../shared/utils/...'` (geo.js / format.js respectivamente); `detectStop` se mantiene importado de `./cockpit.transform.js`.
  - `MODIFICAR src/cockpit/cockpit-stop.service.ts`: `formatDuration` pasa a importarse de `../shared/utils/format.js`; `sanitizeRouteName`/`buildDefaultRouteName` se mantienen de `./cockpit.transform.js` (se tocan en el Paso 3).
  - `MODIFICAR src/routes/route-list.element.ts`: `formatDuration` de `../shared/utils/format.js` en vez de `../cockpit/cockpit.transform.js`.
  - `MODIFICAR src/routes/route-detail.element.ts`: mismo cambio de import de `formatDuration`.
  - `MODIFICAR src/routes/route-timeline.transform.ts`: `calculateDistance` y `calculateAvgSpeed as cockpitAvgSpeed` pasan a importarse de `../shared/utils/geo.js` y `../shared/utils/format.js`; el import de `detectStop` se mantiene apuntando a `../cockpit/cockpit.transform.js`, con un comentario explícito en la línea de import documentando que es la excepción admitida por AC-001 (depende de `StopDetectionState`, tipo específico de `cockpit`).
- **Notas**: Tras este paso, ejecutar la suite completa (`pnpm test`) y confirmar 0 tests rotos antes de continuar — es el paso de mayor "blast radius" junto al Paso 2. Ningún archivo de `route-timeline.transform.spec.ts` necesita cambios (no importa estas 3 funciones directamente, solo a través de `detectStopsFromPoints`).

## Paso 2: Mover `photo-capture` a `src/shared/photo-capture/`

- **Objetivo**: `photo-capture` vive en `shared/` (mismo patrón que `photo-gallery`/`photo-viewer`), consumido por `cockpit` y `routes` sin ningún import cruzado de dominio a dominio. No queda ningún archivo `photo-capture.*` en `src/photos/`.
- **AC cubiertos**: AC-002
- **Tests a escribir**: Ninguno nuevo — es una relocación exacta sin cambio de lógica. El propio `photo-capture.element.spec.ts`, movido sin modificar sus aserciones, es la prueba de que el comportamiento no cambió (RED transitorio: fallará mientras el import `./photo-capture.element.js` del spec apunte al archivo todavía no movido; GREEN en cuanto exista en la nueva ruta). Ejecutar la suite completa tras el movimiento y confirmar que sigue en verde → Valida AC-002 y el invariante de "sin cambio de comportamiento observable".
- **Archivos a crear/modificar**:
  - `CREAR src/shared/photo-capture/photo-capture.types.ts` (idéntico a `src/photos/photo-capture.types.ts`)
  - `CREAR src/shared/photo-capture/photo-capture.element.css` (idéntico a `src/photos/photo-capture.element.css`; los fallbacks `var(--token, #hex)` y el `@keyframes` se arreglan en el Paso 4, no aquí, para no tocar el mismo archivo dos veces en ubicaciones distintas — ver Notas de Implementación de la spec)
  - `CREAR src/shared/photo-capture/photo-capture.element.ts` (idéntico salvo el import de `BaseElement`: `'../shared/base-element.js'` → `'../base-element.js'`; mantener `data-cy`/atributos intactos)
  - `CREAR src/shared/photo-capture/photo-capture.element.spec.ts` (idéntico; los imports relativos `./photo-capture.types.js` / `./photo-capture.element.js` no cambian porque son same-dir)
  - `ELIMINAR src/photos/photo-capture.element.ts`, `photo-capture.element.css`, `photo-capture.types.ts`, `photo-capture.element.spec.ts` (y la carpeta `src/photos/` si queda vacía)
  - `MODIFICAR src/cockpit/cockpit.element.ts`: las 3 líneas de import (`'../photos/photo-capture.element.js'` ×2 y `'../photos/photo-capture.types.js'`) pasan a `'../shared/photo-capture/photo-capture.element.js'` (×2) y `'../shared/photo-capture/photo-capture.types.js'`.
  - `MODIFICAR src/routes/route-detail.element.ts`: mismas 3 líneas de import actualizadas igual.
- **Notas**: Verificar con `grep -r "photos/photo-capture"` tras el paso que no queda ninguna referencia residual (incluye comentarios/JSDoc). Ejecutar suite completa antes de pasar al Paso 3.

## Paso 3: Deduplicar "nombre por defecto de ruta" y "formateo de fecha para mostrar"

- **Objetivo**: una única función de formateo de fecha y una única función de nombre-por-defecto-para-mostrar en `shared/`, usadas de forma idéntica por `route-list`, `route-detail` y (para el caso de guardado real) `cockpit.transform.ts`/`cockpit-stop.service.ts`.
- **AC cubiertos**: AC-003
- **Tests a escribir**:
  - `shared/utils/date.spec.ts`: `formatRouteDate('2026-07-27T12:30:00.000Z')` → `'27 jul 2026'` (formato `day: 'numeric', month: 'short', year: 'numeric'`, es-ES); `formatRouteDate(undefined)` → `''` → Valida AC-003.
  - `shared/utils/route-naming.spec.ts`:
    - `buildDefaultRouteName(dateIso)` → mover tal cual los 2 `it()` que hoy están en `cockpit.transform.spec.ts` (formato con hora) → Valida AC-003 (caso de guardado).
    - `buildRouteDisplayName(name, createdAt)`: devuelve `name` si no está vacío/en blanco tras `trim()`; devuelve `` `Ruta ${formatRouteDate(createdAt)}` `` si `name` es `undefined`/vacío/solo espacios; devuelve `'Ruta '` (cadena vacía de fecha) si además `createdAt` es `undefined` — mismo comportamiento defensivo que hoy tienen `route-list`/`route-detail` en línea → Valida AC-003 y el escenario "nombre por defecto y fecha se muestran igual en listado y detalle".
- **Archivos a crear/modificar**:
  - `CREAR src/shared/utils/date.spec.ts`
  - `CREAR src/shared/utils/date.ts` (`formatRouteDate`)
  - `CREAR src/shared/utils/route-naming.spec.ts`
  - `CREAR src/shared/utils/route-naming.ts` (`buildDefaultRouteName`, movida desde `cockpit.transform.ts`; `buildRouteDisplayName`, nueva, usa `formatRouteDate` internamente)
  - `MODIFICAR src/cockpit/cockpit.transform.ts`: elimina la definición de `buildDefaultRouteName` (ya no vive aquí; `sanitizeRouteName` se queda, no forma parte de "nombre por defecto" ni "formateo de fecha").
  - `MODIFICAR src/cockpit/cockpit.transform.spec.ts`: elimina el `describe('buildDefaultRouteName (AC-002)')` (referencia al AC de la spec `mejoras-guardado-rutas`, no de esta).
  - `MODIFICAR src/cockpit/cockpit-stop.service.ts`: `buildDefaultRouteName` pasa a importarse de `../shared/utils/route-naming.js`; `sanitizeRouteName` se mantiene de `./cockpit.transform.js`.
  - `MODIFICAR src/routes/route-list.element.ts`: sustituir el `name.textContent = route.name?.trim() ? route.name : ...` (líneas ~134-137) por `buildRouteDisplayName(route.name, route.createdAt)`; sustituir el `date.textContent = ...` (línea ~141) por `formatRouteDate(route.createdAt)`.
  - `MODIFICAR src/routes/route-detail.element.ts`: mismo reemplazo en `buildHeader` (líneas ~221-228): título con `buildRouteDisplayName(...)`, párrafo de fecha con `formatRouteDate(...)`.
- **Notas**: Este paso introduce el único cambio visual sancionado por AC-003 (formato de mes unificado a `short`, y `route-detail` gana el `year` que hoy le faltaba en el título) — ver gap #3 al inicio del plan. Recomendable una captura de pantalla de listado y detalle antes/después para que el usuario confirme el resultado, igual que se hizo para AC-007.

## Paso 4: `photo-capture.element.css` — tokens y `prefers-reduced-motion`

- **Objetivo**: `shared/photo-capture/photo-capture.element.css` (ya movido en el Paso 2) importa `tokens.css`, sin fallbacks `var(--token, #hex)`, y el spinner de carga respeta `prefers-reduced-motion` igual que el resto del proyecto.
- **AC cubiertos**: AC-004, AC-005
- **Tests a escribir**:
  - `shared/photo-capture/photo-capture.element.css.spec.ts` (nuevo): importa el CSS con `?inline` y asserta `expect(styles).toContain("@import")` y `expect(styles).toContain('tokens.css')`, y `expect(styles).not.toMatch(/var\(--[a-z0-9-]+,\s*#/)` (ningún fallback hardcodeado) → Valida AC-004. Este test debe estar en rojo antes de tocar el CSS (hoy no hay `@import` y sí hay fallbacks).
  - AC-005 **no es automatizable de forma fiable con jsdom** (no evalúa cascada CSS real ni `@media`, ver Notas). Se documenta como verificación manual: build de desarrollo + DevTools → "Emulate CSS prefers-reduced-motion: reduce" sobre `<photo-capture class="is-loading">`, comprobando que el spinner deja de girar. Documentar el resultado (captura o nota) en el PR.
- **Archivos a crear/modificar**:
  - `CREAR src/shared/photo-capture/photo-capture.element.css.spec.ts`
  - `MODIFICAR src/shared/photo-capture/photo-capture.element.css`: añadir `@import '../styles/tokens.css';` como primera línea; quitar los fallbacks `, #hex`/`, rgba(...)` de todos los `var(--token, ...)` (líneas con `--hitbox-min`, `--line`, `--r-pill`, `--panel`, `--amber`, `--transition-fast`, `--amber-soft`, `--r-md`, `--space-*`, `--shadow-card`, `--ink`, `--font-ui`), dejando `var(--token)` a secas.
- **Notas**: El mecanismo de `prefers-reduced-motion` ya es global vía el bloque `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; ... } }` de `tokens.css` (líneas 178-187) — al quedar `@import`ado dentro del propio `<style>` del Shadow DOM de `photo-capture`, ese `*` selector ya alcanza `.spinner` sin ningún cambio adicional en `@keyframes photo-capture-spin`. Es el mismo mecanismo que ya usan `pulse-dot` en `cockpit.element.css` y el resto de animaciones del proyecto — no hace falta un `@media` local. Confirmar visualmente igualmente (ver test manual arriba) porque depende de que el `@import` se resuelva correctamente en el pipeline de Vite para `?inline`.

## Paso 5: `counter.element.css` y `confirm-dialog.element.css` importan `tokens.css`

- **Objetivo**: consistencia preventiva — ambos archivos ya usan `var(--token)` pero no importan `tokens.css`, incumpliendo la regla general del proyecto.
- **AC cubiertos**: AC-006
- **Tests a escribir**:
  - `src/components/counter/counter.element.css.spec.ts` (nuevo): `expect(styles).toContain("@import")` y `expect(styles).toContain('tokens.css')` → Valida AC-006. Rojo antes de editar (hoy no hay `@import`).
  - `src/shared/feedback/confirm-dialog.element.css.spec.ts` (nuevo): mismas dos aserciones → Valida AC-006.
- **Archivos a crear/modificar**:
  - `CREAR src/components/counter/counter.element.css.spec.ts`
  - `MODIFICAR src/components/counter/counter.element.css`: añadir `@import '../../shared/styles/tokens.css';` como primera línea.
  - `CREAR src/shared/feedback/confirm-dialog.element.css.spec.ts`
  - `MODIFICAR src/shared/feedback/confirm-dialog.element.css`: añadir `@import '../styles/tokens.css';` como primera línea.
- **Notas**: Ninguno de los dos archivos consume hoy ningún token nuevo — el cambio es puramente el `@import`, cero riesgo visual.

## Paso 6: Token `--amber-glow` + eliminación de literales `oklch(...)`

- **Objetivo**: `cockpit.element.css` y `nav-bar.element.css` no contienen ningún literal de color hardcodeado; el resplandor ámbar se consume vía `var(--amber-glow)`, token derivado del mismo OKLCH base que `--amber`. Se registra el ADR correspondiente.
- **AC cubiertos**: AC-007
- **Tests a escribir**:
  - `src/cockpit/cockpit.element.css.spec.ts` (nuevo): `expect(styles).not.toMatch(/oklch\(/)` → Valida AC-007 (rojo antes de editar: hoy hay 5 coincidencias).
  - `src/components/nav-bar/nav-bar.element.css.spec.ts` (nuevo): misma aserción → Valida AC-007 (rojo antes de editar: hoy hay 1 coincidencia).
  - (Opcional pero recomendable) un `expect(styles).toContain('var(--amber-glow)')` en ambos specs para no solo comprobar la ausencia del literal sino el uso explícito del token nuevo.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/styles/tokens.css`: añadir, junto al bloque "Acento primario" (líneas 83-87), `--amber-glow: oklch(60% 0.17 45 / 0.45);` con un comentario indicando que es el token de resplandor puntual para elementos de estado activo (ver ADR-026), derivado de la misma familia OKLCH que `--amber` (hue ~45-48, chroma 0.17).
  - `MODIFICAR src/cockpit/cockpit.element.css`: sustituir los 5 literales (líneas ~61, 96, 123, 219, 237) por `var(--amber-glow)`, manteniendo el resto de cada declaración (`0 0 24px`, `0 0 8px`, `0 0 40px`, `0 0 30px` ×2) sin tocar.
  - `MODIFICAR src/components/nav-bar/nav-bar.element.css`: sustituir el literal de la línea ~72 por `var(--amber-glow)`.
  - `CREAR src/cockpit/cockpit.element.css.spec.ts`
  - `CREAR src/components/nav-bar/nav-bar.element.css.spec.ts`
  - `MODIFICAR memory/decisions.md`: nuevo **ADR-026** — título sugerido "`deuda-tecnica-auditoria` AC-007 — token `--amber-glow` para el resplandor ámbar puntual, no contradice ADR-019". Contenido: contexto (6 literales `oklch(...)` hardcodeados sobrevivientes de antes de ADR-019), decisión (token único derivado de la misma familia OKLCH de `--amber`, valor consolidado `oklch(60% 0.17 45 / 0.45)` aceptando variación menor de intensidad en 4 de los 6 sitios — ver gap #2 de este plan), alternativas consideradas (sintaxis de color relativo `oklch(from var(--amber) ...)` para preservar cada alpha exacto, descartada por riesgo de soporte en WebView Android sin verificar; eliminar el resplandor por completo, descartada porque el usuario ya confirmó mantenerlo el 2026-07-28), consecuencias (cualquier resplandor ámbar futuro reutiliza `--amber-glow`, nunca un literal nuevo).
- **Notas**: Enseñar una comparación visual antes/después al usuario antes de cerrar este paso (ver gap #2). Referenciar ADR-019 explícitamente en el nuevo ADR-026, tal como pide la spec (Dependencias).

## Paso 7: Tests unitarios de validación en `src-tauri/src/commands/mod.rs`

- **Objetivo**: `cargo test` deja de reportar "0 passed; 0 failed"; la lógica de `save_file` (rechazo de rutas absolutas, rechazo de `..`, éxito con ruta relativa válida) y de `greet` (rechazo de nombre vacío) queda cubierta.
- **AC cubiertos**: AC-008
- **Tests a escribir** (RED primero: hoy no existe ningún `#[cfg(test)]` en el crate, así que los 4 tests fallan por no compilar/existir hasta añadir el módulo):
  - `save_file` con ruta absoluta (ej. `C:\tmp\x.txt` o `/tmp/x.txt` según plataforma de CI) → `Err` → Valida AC-008 (nota: esto es lo opuesto a la redacción literal del AC, ver gap #1 al inicio del plan; se testea el comportamiento real, no la descripción textual).
  - `save_file` con ruta relativa sin `..` (ej. `"target/save_file_test_ok.txt"`) y contenido no vacío → `Ok(())`; verificar que el archivo se escribió y limpiarlo al final del test (`std::fs::remove_file`) → Valida AC-008.
  - `save_file` con un componente `..` en la ruta (ej. `"../escape.txt"`) → `Err` (path traversal) → Valida AC-008 y el escenario "`save_file` rechaza intentos de path traversal".
  - `greet` con `String::new()` (string vacío) → `Err` → Valida AC-008.
- **Archivos a crear/modificar**:
  - `MODIFICAR src-tauri/src/commands/mod.rs`: añadir al final `#[cfg(test)] mod tests { use super::*; ... }` con los 4 tests anteriores.
- **Notas**: usar una ruta bajo `target/` (ya existe, gitignored) para el caso de éxito de `save_file` en vez de `std::env::temp_dir()` — este último devuelve una ruta **absoluta**, que el propio código bajo test rechazaría, invalidando el caso de éxito. Verificar que el test de éxito limpia el archivo generado incluso si una aserción falla a mitad (usar un bloque `let _ = fs::remove_file(...);` al final, no dentro de un `assert!` que pueda hacer `panic!` antes de llegar a la limpieza — o aceptar el residuo en `target/`, que de todos modos se borra en cada `cargo clean`).

## Paso 8: Revisión y documentación de `src-tauri/src/recording_service.rs`

- **Objetivo**: dejar constancia explícita, dentro del propio archivo, de por qué no recibe tests unitarios equivalentes a los de AC-008, en vez de omitirlo en silencio.
- **AC cubiertos**: AC-009
- **Tests a escribir**: Ninguno — tras revisar el archivo íntegro, toda su lógica no trivial está `#[cfg(target_os = "android")]` (struct `LocationPoint`, `RecordingServiceHandle` y sus métodos `start/stop/pause/resume`, la constante `LOCATION_EVENT`). La única función compilable fuera de Android es `init()`, que no es una función pura: construye un `TauriPlugin` y su lógica relevante vive dentro de un closure `.setup(...)` que solo se ejecuta con un `tauri::App` real — no es unit-testeable con un `#[test]` plano sin levantar un runtime de Tauri completo, que excede el alcance de un test unitario. Se documenta como limitación conocida en vez de fabricar un test que no pruebe nada real (p. ej. comprobar que `init()` no hace panic, que no aporta señal).
- **Archivos a crear/modificar**:
  - `MODIFICAR src-tauri/src/recording_service.rs`: añadir un comentario doc (`///` o `//`) inmediatamente antes de `pub fn init<R: Runtime>()` explicando: "No existe hoy ninguna función pura en este archivo fuera de `#[cfg(target_os = \"android\")]` que sea unit-testeable con `#[test]` sin un runtime de Tauri real — `init()` solo construye un `TauriPlugin` cuya lógica relevante corre dentro de `.setup()`, que requiere un `tauri::App` real para ejecutarse con sentido. Limitación conocida, ver AC-009 de `specs/features/deuda-tecnica-auditoria.md`."
- **Notas**: No forzar una extracción artificial de sub-lógica solo para "tener un test" (la spec lo permite explícitamente solo "si aporta valor real"): no hay parseo/validación manual de payload en este archivo — la deserialización de `LocationPoint` es automática vía `serde` y ya está cubierta indirectamente por el uso real en Android. Si `review-agent` no está de acuerdo con esta conclusión, reabrir el paso, no forzar cobertura ficticia ahora.

## Paso 9: Cobertura de wrappers Tauri — factories SQLite y `photo-storage.service.ts`

- **Objetivo**: `sqlite-photo.factory.ts`, `sqlite-route.factory.ts` y `photo-storage.service.ts` alcanzan el umbral global del 80% (líneas/ramas/funciones/statements) sin exclusiones nuevas en `vitest.config.ts`, mockeando `@tauri-apps/plugin-sql`/`@tauri-apps/plugin-fs` con el mismo patrón ya usado en `photo-storage.service.spec.ts` (`vi.mock` + `setTauri(true/false)` sobre `window.__TAURI_INTERNALS__`).
- **AC cubiertos**: AC-010
- **Tests a escribir** (antes de tocar nada, deben fallar en rojo por no existir los ficheros/casos):
  - `sqlite-photo.factory.spec.ts`: `vi.mock('@tauri-apps/plugin-sql', ...)` con un `Database.load` simulado; test "crea la conexión y `execute`/`select` delegan en la instancia de `Database`" (éxito) y test "si el plugin no está disponible (import/`Database.load` rechaza), lanza el error descriptivo `SqlitePhotoRepository: Tauri SQL plugin not available...`" (catch) → Valida AC-010.
  - `sqlite-route.factory.spec.ts`: mismo patrón para `createSqliteDb()`, cubriendo además el parámetro opcional `path` (con y sin valor, para no dejar sin cubrir la rama `path ?? 'sqlite:moto-routes.db'`) y el catch con el mensaje `SqliteRouteRepository: Tauri SQL plugin not available...` → Valida AC-010.
  - `photo-storage.service.spec.ts` (extender el existente, no reescribir):
    - `createPhotoRepository()` en Tauri, rama de éxito: mockear `../repositories/sqlite-photo.repository.js` y `../repositories/sqlite-photo.factory.js` para que la creación resuelva sin error, y comprobar que el repositorio devuelto **no** es `MemoryPhotoRepository` (evitar acoplarse al nombre interno del mock si es más robusto comprobar el tipo de mensaje/comportamiento esperado).
    - `createPhotoRepository()` en Tauri, rama catch: forzar que el import/`createSqlitePhotoDb` rechace y comprobar el fallback a `MemoryPhotoRepository` (hoy solo está testeado el caso fuera de Tauri).
    - `buildPhotoMetadata(filePath, routeId, lat, lng)`: test con lat/lng numéricos y test con `null`/`null`, comprobando que `capturedAt` es una fecha ISO válida reciente — hoy esta función no tiene ningún test (0% de cobertura de esta función concreta).
    - `getPhotoUrl` con un `filePath` `.png`: comprobar que el `Blob` creado tiene `type: 'image/png'` (hoy solo se prueba la rama `.jpg` de `mimeTypeFromPath`).
- **Archivos a crear/modificar**:
  - `CREAR src/shared/repositories/sqlite-photo.factory.spec.ts`
  - `CREAR src/shared/repositories/sqlite-route.factory.spec.ts`
  - `MODIFICAR src/shared/services/photo-storage.service.spec.ts` (añadir los `describe`/`it` de arriba; no tocar los ya existentes)
- **Notas**: Revisar primero `src/shared/repositories/sqlite-route.repository.spec.ts` (usa un mock de `SqlDb` en memoria, no de `@tauri-apps/plugin-sql` en sí — no es directamente reutilizable para las factories, que necesitan mockear el módulo `Database.load`, no la interfaz `SqlDb`) y `src/shared/services/photo-capture-adapter.service.spec.ts` (sí reutilizable: mismo patrón `vi.mock('@tauri-apps/plugin-fs', () => ({}))` + toggling de `window.__TAURI_INTERNALS__` ya usado en `photo-storage.service.spec.ts`). No añadir ninguna dependencia nueva — `vi.mock` de Vitest ya cubre lo necesario. Tras este paso, ejecutar `pnpm test:coverage` y confirmar que los 3 archivos superan el 80% y que el umbral global no baja.

---

## Verificación final (todos los pasos)

- `pnpm lint` (0 warnings/errors), `pnpm test` (100% pass), `pnpm test:coverage` (≥80% líneas/ramas/funciones/statements, sin exclusiones nuevas en `vitest.config.ts`), `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (>0 tests, todos en verde) dentro de `src-tauri/`.
- Confirmar con `grep -r "src/photos"` y `grep -r "cockpit/cockpit.transform" src/routes` que no queda ningún import cruzado residual.
- Recordar: los cambios en `src/shared/` (Pasos 1, 2 y 3) se marcan como **CRÍTICO** en `review-agent` por afectar a toda la app.
