# Revisión: Perfil de Usuario

## 📋 Ficheros Tocados (sesión actual, Paso 15 + fixes)
| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `cypress/e2e/perfil/perfil.cy.ts` | CREADO | 8 tests E2E: navegación, placeholders, edición avatar/nombre, cancelar, cascada vPIC, cambio de tipo, error de red, estadísticas |
| `cypress/fixtures/vpic-makes-motorcycle.json`, `vpic-models-honda.json` | CREADO | Fixtures para `cy.intercept()` de la API vPIC |
| `cypress/support/commands.ts` | MODIFICADO | `visitWithSeed()` gana `profile?: Profile` opcional |
| `src/app/app-seed.{service,types,transform}.ts` (+specs) | MODIFICADO | Extiende el mecanismo de siembra Cypress para sembrar `Profile` |
| `src/shared/repositories/memory-profile.repository.ts` (+spec) | MODIFICADO | Añade `seed(profile)` para el mecanismo de siembra |
| `src/shared/repositories/sqlite-route.repository.ts` (+spec) | MODIFICADO | **Fix bug 1**: memoiza la promesa de `ensureSchema()` (antes booleano) — evita condición de carrera con `ALTER TABLE` duplicado. Test de regresión añadido |
| `src/shared/repositories/sqlite-profile.repository.ts` | MODIFICADO | Mismo patrón de memoización aplicado por consistencia (su schema no tiene `ALTER TABLE`, ver análisis abajo). **Sin test de regresión dedicado** |
| `index.html` | MODIFICADO | **Fix bug 2**: sincroniza la CSP hardcodeada con `tauri.conf.json` (host vPIC + `asset:`/`https://asset.localhost`) |
| `src-tauri/src/main.rs` | MODIFICADO | Entry point distingue `#[cfg(mobile)]`/`#[cfg(not(mobile))]` para el tipo de retorno de `app_lib::run()` — necesario para el build Android oficial |
| `scripts/build-apk.ps1` | ELIMINADO | Script alternativo con premisa incorrecta (ver `memory/context.md`) |
| `memory/context.md` | MODIFICADO | Documenta la eliminación del script y el gotcha de `versionCode` |

Todo el trabajo de los Pasos 1-14 (dominio, repos, cliente HTTP/vPIC, CSP, diálogos, vista, navegación) ya está commiteado (`a67ecd5`…`06e2973`) y se ha revisado también contra la spec para este informe.

## 📝 Resumen de Cambios
- Feature completa: modelo de perfil singleton en SQLite/memoria, modal de avatar+nombre, modal de vehículo con cascada vPIC (tipo→marca→modelo), estadísticas agregadas reutilizando `.stat-tile`/`.stat-grid` promovidas a `shared/styles/`, navegación e integración con `<nav-bar>`.
- Paso 15 añade cobertura E2E real y, durante verificación en Android, corrige dos bugs preexistentes (condición de carrera en `ensureSchema()`, CSP desincronizada en `index.html`) más un tercer ajuste de `main.rs` necesario para el build Android oficial.

## ✅ Cumplimiento de AC
Verificado contra código + tests unitarios (Vitest, 703/703 verdes) + E2E (Cypress, 38/38 verdes, incluidos los 8 nuevos de perfil) + `tsc --noEmit`/`eslint --max-warnings 0` limpios, ejecutados de forma independiente en esta revisión (no solo confiando en las notas del plan).

| Bloque | AC | Estado | Implementación | Test |
|--------|-----|--------|-----------------|------|
| 1 | AC-001 a AC-013 | ✅ Cumplido | `profile-header.ts`, `profile-edit-dialog.element.ts`, `photo-storage.service.ts` (reutilizado) | `profile-header.spec.ts`, `profile-edit-dialog.element.spec.ts`, `profile.service.spec.ts`, E2E |
| 2 | AC-014 a AC-027 | ✅ Cumplido | `profile-vehicle-dialog.element.ts`, `vpic.service.ts`, `external-api.service.ts`, `tauri.conf.json`+`index.html` | `profile-vehicle-dialog.element.spec.ts`, `vpic.service.spec.ts`, `external-api.service.spec.ts`, `tauri-conf.spec.ts`, E2E |
| 3 | AC-028 a AC-034 | ✅ Cumplido | `profile.transform.ts` (`computeProfileStats`), `profile.element.ts`, `shared/styles/stat-tile.css` | `profile.transform.spec.ts`, `profile.element.spec.ts`, `stat-tile.css.spec.ts`, E2E |
| Nav | AC-035, AC-036 | ✅ Cumplido | `app-events.ts`, `nav-bar.element.ts` (`activeView`), `app.element.ts` | `nav-bar.element.spec.ts`, E2E |
| Nav | AC-037 | ✅ Cumplido | todos los controles listados en el AC tienen `data-cy` verificado por grep (ver ISSUE-001, resuelto: los elementos de solo lectura de estadísticas/vehículo/nombre también ganaron `data-cy`) | unitarios + E2E |
| Nav | AC-038 | ✅ Cumplido | `--hitbox-min` (56px) aplicado en los 5 ficheros CSS de `profile/` | unitarios (clase CSS) |

No se detectaron gaps: los 38 AC están implementados y cada uno tiene al menos un test que ejercita Dado/Cuando/Entonces (unitario y/o E2E).

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias de secretos/credenciales (vPIC no requiere API key).
- ✅ CSP: `connect-src` añade el host exacto `https://vpic.nhtsa.dot.gov` (verificado con `tauri-conf.spec.ts`, sin comodines), consistente con ADR-014/ADR-028.
- ✅ **Fix correcto**: `index.html` (meta CSP hardcodeada del WebView) estaba desincronizada de `tauri.conf.json` desde el Paso 6 — se ha sincronizado en esta sesión. Confirmado por diff: ambos ficheros contienen ahora exactamente los mismos hosts en `connect-src`/`img-src`.
- ✅ Inputs: nombre saneado con `sanitizeText`/límite 100; los `<select>` de vehículo no aceptan texto libre.

### Componentes Comunes Afectados
- ⚠️ `shared/repositories/sqlite-route.repository.ts` (memoización de `ensureSchema()`): cambio en repositorio compartido por `route-list`/`route-detail`/`cockpit`. Verificado con test de regresión dedicado (`runs the migration exactly once when two callers race...`) y con la suite completa en verde (703/703 Vitest, 38/38 Cypress) — sin regresiones detectadas.
- ⚠️ `shared/repositories/sqlite-profile.repository.ts`: mismo patrón aplicado por consistencia. **Verificado personalmente** (no asumido): su `SCHEMA` es únicamente `CREATE TABLE IF NOT EXISTS profile (...)`, sin ningún `ALTER TABLE` — a diferencia de `routes`, no hay ninguna vía real por la que una carrera entre `ensureSchema()` concurrentes produjera un error SQL, ya que `CREATE TABLE IF NOT EXISTS` es idempotente. El cambio es correcto y no rompe nada, pero no tiene test de regresión propio (sí lo tiene `sqlite-route.repository.spec.ts`).
- ⚠️ `SqlitePhotoRepository.ensureSchema()` (`src/shared/repositories/sqlite-photo.repository.ts`) **no se tocó** y sigue con el booleano `initialized` sin memoizar. Confirmado por lectura directa del archivo: su `SCHEMA` es solo `CREATE TABLE IF NOT EXISTS photos (...)` (sin `ALTER TABLE`), igual que `profile` — no hay bug funcional real, solo trabajo redundante (repetir `PRAGMA`/`CREATE TABLE IF NOT EXISTS` en llamadas concurrentes antes de que `initialized` se ponga a `true`). No bloqueante, pero es una inconsistencia de patrón entre los tres repositorios SQLite que vale la pena homogeneizar en una futura pasada de mantenimiento (no en el alcance de esta spec).
- `shared/styles/stat-tile.css` (promoción del Paso 7, ya commiteada): verificado que `cockpit.element.css` no quedó con la regla duplicada y que el contenido es literal-idéntico (tests de guarda `stat-tile.css.spec.ts`/`cockpit.element.css.spec.ts` en verde).

### Actualizaciones Core
- ⚠️ `src-tauri/src/main.rs`: cambia el `main()` de Tauri para bifurcar `#[cfg(mobile)]`/`#[cfg(not(mobile))]` en el manejo del retorno de `app_lib::run()`. Es un cambio de infraestructura de build (necesario para que `pnpm tauri android build` funcione sin el script alternativo eliminado), no relacionado con ningún AC de esta spec. Comportamiento en desktop sin cambios (rama `not(mobile)` conserva `?`). No tiene test (Rust no cubre `main.rs`, consistente con el resto del proyecto). Se documenta aquí por ser cambio en el entry point de Tauri, pero es de bajo riesgo y ya verificado en build Android real según el plan.
- ✅ Sin cambios de versión en `package.json`/`Cargo.toml` ni dependencias nuevas.

### Normas Saltadas
- ❌ **`cypress/e2e/perfil/perfil.cy.ts` usa selectores de clase CSS en 14 aserciones** (`cy.contains('.profile-name', ...)` líneas 71/79/85/96/109/110, `cy.get('.vehicle-summary')` líneas 143/183/194, `cy.contains('.stat-tile', ...)` líneas 215-219), violando la regla absoluta de `CLAUDE.md` ("nunca selectores de clase, ID o posición DOM en tests") y `docs/07-cypress-e2e.md`. Es el único spec de todo `cypress/e2e/` que lo hace (verificado por grep contra el resto de la suite). Los elementos afectados (`.profile-name` en `profile-header.ts`, `.vehicle-summary`/`.stat-tile`/`.stat-value` en `profile.element.ts`) no tienen `data-cy` propio. No hay ninguna nota en el plan que justifique esta excepción — no está documentada como decisión de diseño. Ver ISSUE-001.

## ⚠️ Issues Encontrados

### ISSUE-001: Selectores de clase CSS en tests E2E de Perfil — ✅ RESUELTO
- **Severidad**: MEDIA
- **AC afectado**: No es un AC per se (AC-037 solo exige `data-cy` en "controles interactivos", y estos son elementos de solo lectura) — es una violación de la norma transversal `data-cy obligatorio` de `CLAUDE.md`/`docs/07-cypress-e2e.md`, aplicable a "todo elemento... que un test E2E pueda necesitar localizar".
- **Descripción**: `perfil.cy.ts` localizaba el nombre de perfil, el resumen de vehículo y las tarjetas de estadísticas con `cy.contains('.profile-name', ...)`, `cy.get('.vehicle-summary')` y `cy.contains('.stat-tile', ...)` en vez de `data-cy`.
- **Resolución**: añadido `data-cy="profile-name"` a `profile-header.ts` (`buildNameElement`), `data-cy="profile-vehicle-summary"` a `profile.element.ts` (`buildVehicleDetails`), y `data-cy="profile-stat-km-totales"`/`profile-stat-tiempo-total`/`profile-stat-ruta-mas-larga`/`profile-stat-num-rutas`/`profile-stat-vel-media` a cada tarjeta de `buildStatTile()` (nuevo parámetro `dataCy`). Los 14 selectores de `perfil.cy.ts` actualizados. Reverificado tras el fix: 703/703 Vitest, 38/38 Cypress (incluidos los 8 de `perfil.cy.ts`), `tsc`/ESLint limpios.

### ISSUE-002: Inconsistencia de patrón `ensureSchema()` entre repositorios SQLite
- **Severidad**: BAJA
- **AC afectado**: Ninguno directamente (no hay AC de esta spec sobre este detalle interno)
- **Descripción**: Tras el fix de esta sesión, `SqliteRouteRepository` y `SqliteProfileRepository` memoizan la promesa de `ensureSchema()`, pero `SqlitePhotoRepository` sigue con el booleano `initialized` sin memoizar. No es un bug activo (su schema no tiene `ALTER TABLE`, verificado), pero deja el código en un estado inconsistente entre tres clases con el mismo propósito.
- **Recomendación**: Homogeneizar `SqlitePhotoRepository.ensureSchema()` al mismo patrón en una futura tarea de mantenimiento (fuera del alcance estricto de esta spec, no bloqueante).

## 📊 Veredicto
- [x] APPROVED

Los 38 AC están implementados y verificados con tests reales que pasan (`tsc` limpio, ESLint 0 warnings, 703/703 Vitest, 38/38 Cypress incluyendo la suite de perfil). Los dos bugs corregidos en el Paso 15 (condición de carrera en `ensureSchema()` y CSP desincronizada) están bien resueltos, con test de regresión para el primero y verificación por diff para el segundo; el análisis sobre `SqlitePhotoRepository` confirma que no comparte el bug real (solo el patrón menos idiomático, ISSUE-002, no bloqueante, fuera de alcance). ISSUE-001 (selectores de clase en `perfil.cy.ts`) quedó corregido en la misma sesión — reverificado con la suite completa en verde tras el fix. Sin bloqueantes pendientes. Feature `perfil-usuario` lista para cerrar.

---

# Adenda: Bloque 4 — Buscador de marca, precarga y spinner de guardado (Paso 16, AC-039 a AC-042)

Revisión específica del incremento post-cierre añadido el 2026-08-02 tras verificación en dispositivo Android real. No se reabre lo ya aprobado arriba (AC-001 a AC-038); esta sección cubre exclusivamente el Bloque 4.

## 📋 Ficheros Tocados
| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/profile/profile-vehicle-dialog.transform.ts` | CREADO | Lógica pura `isKnownMake`/`buildMakeOptionsList` + `KNOWN_VEHICLE_MAKES` (44 marcas curadas) |
| `src/profile/profile-vehicle-dialog.transform.spec.ts` | CREADO | 8 tests unitarios puros |
| `src/profile/profile-vehicle-dialog-fields.ts` | MODIFICADO | `buildMakeSelect` (nativo) sustituido por `buildMakeCombobox`/`buildMakeOptionsListbox` (buscador + listbox de botones) |
| `src/profile/profile-vehicle-dialog.element.ts` | MODIFICADO | `preloadCurrentVehicle()` (fix AC-039); `handleMakeQueryChange()` con parcheo aislado del DOM (fix bug de foco) |
| `src/profile/profile-vehicle-dialog.element.css` | MODIFICADO | Estilos de `.make-combobox`/`.make-options`/`.make-option`, tokens del sistema de diseño, hitbox 56px |
| `src/profile/profile-vehicle-dialog.element.spec.ts` | REESCRITO | 22 tests (4 nuevos + 2 renombrados) |
| `src/profile/profile-edit-dialog.element.ts` | MODIFICADO | Estado `saving`, spinner en "Guardar", deshabilitado de controles (AC-042) |
| `src/profile/profile-edit-dialog.element.css` | MODIFICADO | `.spinner`/`@keyframes profile-edit-spin` |
| `src/profile/profile-edit-dialog.element.spec.ts` | MODIFICADO | +3 tests (16 en total) |
| `src/profile/profile.element.spec.ts` | MODIFICADO | 1 test ajustado al nuevo combobox de marca |
| `cypress/fixtures/vpic-makes-motorcycle.json` | MODIFICADO | +2 marcas minoritarias para testear filtro/priorización |
| `cypress/e2e/perfil/perfil.cy.ts` | MODIFICADO | Helper `chooseMake()`, test de precarga nuevo, tests existentes ampliados |
| `specs/features/perfil-usuario.md` | MODIFICADO | Bloque 4, AC-039 a AC-042 |
| `specs/features/perfil-usuario.plan.md` | MODIFICADO | Paso 16 |

## 📝 Resumen de Cambios
- Sustituye el `<select>` nativo de marca por un buscador de texto + listbox (botones con `role="option"`), con filtro en cliente y priorización de una lista curada de ~44 fabricantes conocidos, sin ocultar nunca marcas devueltas por vPIC.
- Corrige un bug real: al editar un vehículo ya guardado, `open()` ahora precarga marcas/modelos automáticamente vía `preloadCurrentVehicle()`, sin depender de que el usuario toque el selector de tipo.
- Corrige un segundo bug real encontrado durante el TDD de este paso: `handleMakeQueryChange()` ya no dispara un `render()` completo en cada pulsación (que destruía y recreaba el `<input>`, perdiendo foco/cursor) — reconstruye únicamente el listbox de opciones.
- Añade spinner + deshabilitado de controles en "Editar perfil" mientras se guarda (foto a disco + persistencia), con Escape/overlay-click ignorados durante el guardado.

## ✅ Cumplimiento de AC
| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-039 | ✅ Cumplido | `profile-vehicle-dialog.element.ts` (`open()` → `preloadCurrentVehicle()`) | Unitario (`preloads makes and models automatically...`, `does not attempt to preload models when preloading makes fails`) + E2E (`editing an already-configured vehicle preloads...`) | Verificado que no viola AC-024 (ver sección Seguridad/CRÍTICO) |
| AC-040 | ✅ Cumplido | `profile-vehicle-dialog-fields.ts` (`buildMakeCombobox`) + `profile-vehicle-dialog.transform.ts` (`buildMakeOptionsList`, rama con query) | Unitario (`buildMakeOptionsList` x5, `filters the rendered make options as the user types...`) + E2E (`el buscador filtra la lista sin volver a llamar a vPIC`) | Insensible a mayúsculas confirmado por test explícito |
| AC-041 | ✅ Cumplido | `profile-vehicle-dialog.transform.ts` (`buildMakeOptionsList`, rama sin query, `KNOWN_VEHICLE_MAKES`/`isKnownMake`) | Unitario (`shows known makes first (alphabetical) then the rest (alphabetical)...`) + E2E (comprueba índice de HONDA/YAMAHA antes de las minoritarias) | Nunca oculta marcas (verificado con `.toEqual` exhaustivo, no solo `.toContain`) |
| AC-042 | ✅ Cumplido | `profile-edit-dialog.element.ts` (`saving`, `buildSaveButton()`) + `.css` (`.spinner`) | Unitario (3 tests: spinner+disabled, Escape/overlay ignorados, recuperación tras fallo) | Nombre capturado síncronamente antes del spinner, evita pérdida de texto al re-renderizar |

Los 4 AC del Bloque 4 están implementados y cada uno tiene cobertura Dado/Cuando/Entonces (unitaria y/o E2E). Verificado de forma independiente en esta revisión (no solo confiando en las notas del plan):
- `tsc --noEmit`: sin errores.
- `eslint src --max-warnings 0`: sin errores/warnings (todo `src/`, no solo `profile/`).
- `vitest run`: **717/717 verdes** (coincide con lo declarado en el plan).
- `cypress run --spec cypress/e2e/perfil/perfil.cy.ts`: **9/9 verdes**.

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias. No se añaden nuevos endpoints ni secretos. `KNOWN_VEHICLE_MAKES` es una constante estática sin datos sensibles.
- ✅ **AC-024 no violado por el fix de AC-039**: `profile.element.ts` no importa ni referencia `vpic.service.ts`/`fetchVehicleMakes`/`fetchVehicleModels` en ningún punto (verificado por grep) — la sección "Mi vehículo" sigue leyendo únicamente de `IProfileRepository`. `preloadCurrentVehicle()` vive exclusivamente en `profile-vehicle-dialog.element.ts`, que solo se instancia al pulsar "Editar vehículo" (`openVehicleEditDialog`, invocado desde el manejador de ese botón). El test E2E `editing an already-configured vehicle preloads...` y el de error de vPIC confirman que la petición ocurre tras abrir el diálogo, no al cargar la vista.

### Componentes Comunes Afectados
- ✅ Ninguno. Todos los cambios están acotados a `src/profile/` y sus tests/fixtures asociados; no se toca `shared/` en este incremento.

### Actualizaciones Core
- ✅ Ninguna. Sin cambios de dependencias ni configuración de build/lint/TS.

### Normas Saltadas
- ⚠️ **`data-cy="profile-marca-option"` repetido entre las N opciones del listbox de marca** — a primera vista choca con la regla "todo elemento interactivo lleva un `data-cy` único" de `CLAUDE.md`/`docs/07-cypress-e2e.md`. Comparado con el precedente real ya existente en el proyecto (`route-card` en `src/routes/list/route-list.element.ts:125`, mismo `data-cy` repetido en cada tarjeta de una lista, desambiguado en tests con `cy.contains('[data-cy="route-card"]', route.name)`), el patrón es coherente: `perfil.cy.ts` (`chooseMake()`) desambigua igual, con `cy.get(...).contains('[data-cy="profile-marca-option"]', make)`, y el test unitario `gives every new interactive control a unique data-cy, with make options sharing one data-cy by design (same pattern as route-card)` deja la excepción documentada explícitamente en el propio código de test. Se considera una aplicación consistente de un precedente ya aceptado, no una norma saltada sin justificar — no bloqueante.

## ⚠️ Issues Encontrados

### ISSUE-003: El texto del buscador de marca puede quedar desincronizado de la marca realmente seleccionada — ✅ RESUELTO
- **Severidad**: MEDIA
- **AC afectado**: AC-040 (relacionado, no una violación directa de la letra del AC)
- **Descripción**: `handleMakeQueryChange()` actualizaba `makeQuery` en cada pulsación pero nunca tocaba `selectedMake`/`selectedModel` ni `canSave`. Si el usuario, tras elegir una marca, escribía en el buscador sin llegar a pulsar una opción, el texto visible dejaba de coincidir con la marca realmente seleccionada, pero "Guardar" seguía habilitado y persistiría la marca antigua.
- **Resolución**: `handleMakeQueryChange()` ahora descarta `selectedMake`/`selectedModel` (y deshabilita "Guardar"/el select de modelo) en cuanto el texto escrito deja de coincidir con la marca elegida — solo ocurre una vez por divergencia (no en cada tecla), así que no reintroduce la pérdida de foco que motivó la actualización aislada del listbox. Test de regresión nuevo (`discards the chosen make (and disables "Guardar") if the search text is edited away from it without picking a new option`).

### ISSUE-004: Estado "sin resultados" del buscador de marca sin `data-cy` y sin test — ✅ RESUELTO
- **Severidad**: BAJA
- **Resolución**: añadido `data-cy="profile-marca-empty"` a `buildMakeOptionsEmpty()` (`profile-vehicle-dialog-fields.ts`) y test nuevo (`shows a labelled empty state when the search matches no make`).

### ISSUE-005: Trazabilidad AC en nombres de test — precarga referencia "AC-017" en vez de "AC-039" — ✅ RESUELTO
- **Severidad**: BAJA
- **Resolución**: ambos títulos de test (unitario y E2E) renombrados para referenciar "(AC-039)".

## 📊 Veredicto — Bloque 4
- [x] APPROVED

Los 4 AC del Bloque 4 (AC-039 a AC-042) están implementados correctamente y verificados con tests reales que pasan (`tsc` limpio, ESLint 0 warnings sobre todo `src/`, 719/719 Vitest, 39/39 Cypress incluidos los 9 de `perfil.cy.ts`). Los dos bugs reales descritos en el plan (precarga de marca/modelo al editar sin tocar el tipo, y pérdida de foco por `render()` completo en cada tecla) están corregidos con tests de regresión específicos. El fix de AC-039 no viola AC-024 (verificado por lectura directa: `profile.element.ts` no conoce `vpic.service.ts`). El patrón `data-cy="profile-marca-option"` compartido está justificado por precedente real (`route-card`) y correctamente desambiguado en tests. Los 3 issues no bloqueantes (ISSUE-003/004/005) quedaron resueltos en la misma sesión, reverificados con la suite completa en verde. Sin bloqueantes pendientes. Confirmado además por el usuario en dispositivo Android real (buscador, precarga y spinner de guardado funcionando correctamente).
