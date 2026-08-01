# Revisión: Cobertura E2E real con Cypress

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `cypress.config.ts` | MODIFICADO | `supportFile` activado + `includeShadowDom: true` (gap de infra crítico, sin esto ningún `data-cy` era localizable). |
| `cypress/support/e2e.ts` | CREADO | Import de `@testing-library/cypress` + `commands.ts`. |
| `cypress/support/commands.ts` | CREADO | Comando `cy.visitWithSeed()` (siembra rutas/puntos/paradas vía `cypress-seed-routes`, fotos vía `moto-routes-photos`, ambos por `onBeforeLoad`). |
| `cypress/e2e/cockpit/cockpit.cy.ts` | MODIFICADO | Quitado test de "Modo Invisible"; `data-cy` en vez de selector CSS; +5 tests de flujo completo (pausa, long-press, guardar, descartar). |
| `cypress/e2e/route-list/route-list.cy.ts` | CREADO | 4 tests: listado con N rutas, vacío, eliminar+confirmar, eliminar+cancelar. |
| `cypress/e2e/route-detail/route-detail.cy.ts` | CREADO | 6 tests: navegación, pestañas, notas (crear/ver/editar). |
| `cypress/e2e/route-detail/timeline.cy.ts` | CREADO | 3 tests: salida/llegada, evento de foto, estado vacío. |
| `cypress/e2e/fotos/fotos.cy.ts` | CREADO | 9 tests: placeholder, alta cámara/galería, visor, marcador de mapa, 4 escenarios del límite de 100 fotos. |
| `cypress/fixtures/photo-sample.jpg` | CREADO | JPEG mínimo (287 bytes) para `cy.selectFile()`. |
| `package.json` / `pnpm-lock.yaml` | MODIFICADO | Scripts `cy:open`/`cy:run`/`test:e2e`; `start-server-and-test` como devDependency. |
| `src/cockpit/cockpit.render.ts` (+spec) | MODIFICADO | `data-cy="cockpit-speed-value"` en `buildSpeedDisplay()`. |
| `src/routes/list/route-list.element.ts` (+spec) | MODIFICADO | `data-cy="route-card"` y `data-cy="route-list-empty"`. |
| `src/shared/services/photo-capture-adapter.service.ts` (+spec) | MODIFICADO | Input de archivo adjuntado temporalmente al DOM con `data-cy="photo-capture-input-file"`, retirado al resolver. |
| `src/app/app-seed.types.ts` | CREADO | Tipo `CypressSeedData`. |
| `src/app/app-seed.transform.ts` (+spec) | CREADO | `parseCypressSeed()` — parseo puro con guardas explícitas. |
| `src/app/app-seed.service.ts` (+spec) | CREADO | `applyCypressSeed()` — ata `isTauri()` + `localStorage` + `repo.seed()`. |
| `src/app/app.element.ts` | MODIFICADO (core) | `init()` reestructurado: decide primero por `isTauri()`, aplica siembra solo fuera de Tauri. |
| `src/shared/repositories/memory-route.repository.ts` (+spec) | MODIFICADO (core) | Nuevo método `seed()` — carga directa sin pasar por `save()`. |
| `src/shared/photo-capture/photo-capture.types.ts` | MODIFICADO | `MAX_PHOTOS_PER_ROUTE = 100`. |
| `src/shared/photo-capture/photo-capture.limit.ts` (+spec) | CREADO | `applyPhotoCaptureLimit()` — único punto que decide `disabled`/`limitReached` a la vez. |
| `src/shared/photo-capture/photo-capture.element.ts` (+spec) | MODIFICADO (core/shared) | Nueva propiedad `limitReached` (getter/setter, atributo reflejado, texto accesible diferenciado). |
| `src/routes/detail/route-detail.element.ts` (+spec) | MODIFICADO | `data-cy="route-detail-title"` en el `<h1>`; wiring de `applyPhotoCaptureLimit()` en `buildAddPhotoButton()`. |
| `src/cockpit/cockpit.element.ts` (+spec) | MODIFICADO | Wiring de `applyPhotoCaptureLimit()` en `refreshGallery()` y `handleDeletePhoto()`. |
| `vitest.config.ts` | MODIFICADO | `src/app/app-seed.types.ts` excluido de coverage (contrato puro). |
| `CLAUDE.md` | MODIFICADO (fuera de plan) | Se añade/consolida la regla `data-cy` obligatoria en "Convenciones de Frontend"; no está listado en ningún paso del plan. Ver ISSUE-002. |
| `specs/features/cobertura-e2e.md` / `.plan.md` | CREADOS (previos a esta revisión) | Spec y plan del feature. |

## 📝 Resumen de Cambios

- Se repara el único spec Cypress existente (`cockpit.cy.ts`), roto por una funcionalidad retirada y un selector CSS, y se activa la infraestructura mínima para poder ejecutar Cypress (`supportFile`, scripts npm, `includeShadowDom`).
- Se introduce un mecanismo de siembra de datos (`cypress-seed-routes` en `localStorage`) exclusivo de entornos fuera de Tauri, con parseo puro testeado exhaustivamente y un método `seed()` nuevo en `MemoryRouteRepository`.
- Se añaden los `data-cy` que faltaban para poder testear (`cockpit-speed-value`, `route-card`, `route-list-empty`, `photo-capture-input-file`, `route-detail-title`).
- Se implementa el límite de 100 fotos por ruta (comportamiento nuevo, no solo cobertura), con una única función (`applyPhotoCaptureLimit`) que sincroniza `disabled`/`limitReached` en `<photo-capture>`, invocada desde `<route-detail>` y `<cockpit-view>`.
- Se amplía la cobertura E2E a 5 specs Cypress cubriendo cockpit, route-list, route-detail, fotos y timeline.
- Verificado de forma independiente en esta revisión (no solo tomando el resumen del plan como cierto): `pnpm run test:e2e` → **30/30 Cypress en verde**; `vitest run` → **567/567 en verde**; `tsc --noEmit` limpio; `eslint src/` sin errores/warnings; cobertura global 96.7% líneas / 90.99% branches (por encima del umbral 80%); los ficheros nuevos de este feature (`app-seed.*`, `photo-capture.limit.ts`, `memory-route.repository.ts::seed()`, `photo-capture-adapter.service.ts`) tienen 100% de cobertura de sentencias.
- Gap encontrado durante esta revisión, no reportado por el resumen recibido: el **Paso 8 del plan** prometía actualizar `docs/07-cypress-e2e.md` con una sección "Siembra de datos en Moto Routes" (parte de AC-012) — ese archivo **no fue tocado**. La documentación de la siembra de fotos vive solo como comentario JSDoc en `cypress/support/commands.ts`.
- `CLAUDE.md` aparece modificado en el working tree sin que ningún paso del plan lo mencione, y sin evidencia visible de que se haya "avisado antes" como exige la propia regla de `CLAUDE.md` ("No modificar este CLAUDE.md... sin avisar primero"). Ver ISSUE-002.

## ✅ Cumplimiento de AC

| AC | Estado | Implementación | Test | Notas |
|----|--------|-----------------|------|-------|
| AC-001 | ✅ Cumplido | `cypress/e2e/cockpit/cockpit.cy.ts` | Ejecución real Cypress | Sin test de "Modo Invisible". |
| AC-002 | ✅ Cumplido | `cypress/e2e/cockpit/cockpit.cy.ts` | Ejecución real Cypress | Usa `[data-cy="cockpit-speed-value"]`. |
| AC-003 | ✅ Cumplido | `src/cockpit/cockpit.render.ts:29` | `cockpit.render.spec.ts` | - |
| AC-004 | ✅ Cumplido | `cockpit.cy.ts` (3 tests originales) | Ejecución real: 8/8 pass en `cockpit.cy.ts` | Verificado independientemente vía `pnpm run test:e2e`. |
| AC-005 | ✅ Cumplido | `package.json` scripts | - | `cy:open`/`cy:run`/`test:e2e` presentes. |
| AC-006 | ✅ Cumplido | `package.json` devDependencies | - | `start-server-and-test@^3.0.11`. |
| AC-007 | ✅ Cumplido | `src/app/app-seed.service.ts`, `src/app/app.element.ts:49-63` | `app-seed.service.spec.ts` | `isTauri()` como guarda explícita antes de `localStorage.getItem`. |
| AC-008 | ✅ Cumplido | `app-seed.service.ts` + `memory-route.repository.ts::seed()` + `app.element.ts` (orden: seed antes de `render()`) | `app-seed.service.spec.ts`, `memory-route.repository.spec.ts`, `route-list.cy.ts` (AC-019) | Verificado E2E real. |
| AC-009 | ✅ Cumplido | `app-seed.transform.ts`, `app-seed.service.ts` | `app-seed.transform.spec.ts`, `app-seed.service.spec.ts`, `route-list.cy.ts` (AC-020) | Sin excepción, repo vacío. |
| AC-010 | ✅ Cumplido | `app-seed.service.ts:21` (`if (isTauri()) return`) + guarda duplicada en `app.element.ts` | `app-seed.service.spec.ts` (spy sobre `Storage.prototype.getItem`) | Defensa en profundidad, doble guarda intencional. |
| AC-011 | ✅ Cumplido | `src/app/app-seed.transform.ts` | `app-seed.transform.spec.ts` (6 casos: válido+points+stops, ausente, corrupto, sin `routes`/no-array, `routes: []`, solo `routes`) | Cobertura 100% de la función. |
| AC-012 | ✅ Cumplido | `cypress/support/commands.ts` + `docs/07-cypress-e2e.md` (sección "Siembra de datos en Moto Routes", añadida tras esta revisión) | `fotos.cy.ts`, `timeline.cy.ts` usan `cy.visitWithSeed({ photos })` con éxito | ISSUE-001 resuelto post-revisión: sección añadida documentando `cy.visitWithSeed()` y la clave `moto-routes-photos`. |
| AC-013 | ✅ Cumplido | `cockpit.cy.ts` | Ejecución real | - |
| AC-014 | ✅ Cumplido | `cockpit.cy.ts` | Ejecución real | - |
| AC-015 | ✅ Cumplido | `cockpit.cy.ts` | Ejecución real | - |
| AC-016 | ✅ Cumplido | `cockpit.cy.ts` (long-press 1700ms real) | Ejecución real | - |
| AC-017 | ✅ Cumplido | `cockpit.cy.ts` | Ejecución real | - |
| AC-018 | ✅ Cumplido | `cockpit.cy.ts` | Ejecución real | - |
| AC-019 | ✅ Cumplido | `route-list.cy.ts` | Ejecución real | - |
| AC-020 | ✅ Cumplido | `route-list.cy.ts` | Ejecución real | - |
| AC-021 | ✅ Cumplido | `route-list.cy.ts` | Ejecución real | - |
| AC-022 | ✅ Cumplido | `route-list.cy.ts` | Ejecución real | - |
| AC-023 | ✅ Cumplido | `route-detail.element.ts:221` (`data-cy="route-detail-title"`) | `route-detail.cy.ts`, `route-detail.element.spec.ts` | Gap de `data-cy` detectado y corregido durante la implementación (documentado en el plan, Paso 14), verificado presente en el código. |
| AC-024 | ✅ Cumplido (con matiz documentado) | `route-detail.cy.ts` | Ejecución real | La parte "sin nueva petición al repositorio" no es observable estrictamente desde Cypress; se apoya en el efecto observable (sin parpadeo de `route-detail-loading`) + garantía a nivel de unidad. Limitación reconocida explícitamente en el plan, no oculta. |
| AC-025 | ✅ Cumplido | `route-detail.cy.ts` | Ejecución real | - |
| AC-026 | ✅ Cumplido | `route-detail.cy.ts` | Ejecución real | - |
| AC-027 | ✅ Cumplido | `route-detail.cy.ts` | Ejecución real | - |
| AC-028 | ✅ Cumplido | `route-detail.cy.ts` | Ejecución real | - |
| AC-029 | ✅ Cumplido | `fotos.cy.ts` | Ejecución real | - |
| AC-030 | ✅ Cumplido | `fotos.cy.ts` + `photo-capture-input-file` (AC-038) | Ejecución real | - |
| AC-031 | ✅ Cumplido | `fotos.cy.ts` | Ejecución real | - |
| AC-032 | ✅ Cumplido | `fotos.cy.ts` | Ejecución real | - |
| AC-033 | ✅ Cumplido | `fotos.cy.ts` | Ejecución real | - |
| AC-034 | ✅ Cumplido | `fotos.cy.ts` | Ejecución real (`timeout: 20000` para carga de tiles) | - |
| AC-035 | ✅ Cumplido | `timeline.cy.ts` | Ejecución real (orden verificado con `compareDocumentPosition`) | - |
| AC-036 | ✅ Cumplido | `timeline.cy.ts` | Ejecución real | - |
| AC-037 | ✅ Cumplido | `timeline.cy.ts` | Ejecución real | - |
| AC-038 | ✅ Cumplido | `photo-capture-adapter.service.ts:45-80` | `photo-capture-adapter.service.spec.ts` (3 casos: localizable, retirado tras `change`, retirado tras `cancel`) + `fotos.cy.ts` E2E | - |
| AC-039 | ✅ Cumplido | `route-list.element.ts:125` | `route-list.element.spec.ts` | - |
| AC-040 | ✅ Cumplido | `route-list.element.ts:109` | `route-list.element.spec.ts` | - |
| AC-041 | ✅ Cumplido | `photo-capture.limit.ts`, wiring en `route-detail.element.ts:263` y `cockpit.element.ts:226` | `photo-capture.limit.spec.ts`, `route-detail.element.spec.ts`, `cockpit.element.spec.ts`, `fotos.cy.ts` | - |
| AC-042 | ✅ Cumplido | `photo-capture.element.ts` (`buttonLabel()`) | `photo-capture.element.spec.ts`, `fotos.cy.ts` | Diferenciado de `loading` (test explícito). |
| AC-043 | ✅ Cumplido | `photo-capture.limit.ts` | `photo-capture.limit.spec.ts`, `route-detail.element.spec.ts`, `cockpit.element.spec.ts`, `fotos.cy.ts` | - |
| AC-044 | ✅ Cumplido | `cockpit.element.ts:226,239`, `route-detail.element.ts` (`refreshAllPanels()`) | `route-detail.element.spec.ts`, `cockpit.element.spec.ts`, `fotos.cy.ts` | - |
| AC-045 | ✅ Cumplido | ídem AC-044 | ídem AC-044 | - |

**45/45 AC cumplidos con verificación independiente** (AC-012 quedó completo tras añadir la sección de documentación que faltaba, ver ISSUE-001).

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias. No hay secretos/tokens en código. `index.html` y `src-tauri/tauri.conf.json` (CSP) no fueron tocados. El mecanismo de siembra está correctamente aislado de producción: doble guarda `isTauri()` (en `app.element.ts` y en `applyCypressSeed()`), verificado con test que espía `Storage.prototype.getItem` para probar que ni siquiera se lee `localStorage` en Tauri. El input de archivo temporalmente adjuntado al DOM (`photo-capture-input-file`) se retira siempre al resolver (`change` y `cancel`), sin quedar colgado ni alterar la validación existente de `validatePhoto()`.

### Componentes Comunes Afectados
- ⚠️ Esta feature modifica varios componentes/servicios compartidos (`src/shared/`) y el arranque de la app (`src/app/app.element.ts`), lo que afecta potencialmente a toda la aplicación:
  - **`src/app/app.element.ts`** — se reestructura `init()`: antes se intentaba SQLite siempre y se caía a memoria si fallaba; ahora decide primero por `isTauri()`. En Tauri el comportamiento observable es idéntico (intenta SQLite, cae a memoria si falla). Fuera de Tauri, antes también se intentaba `createSqliteDb()` (probablemente fallando siempre en navegador) y ahora se va directo a `MemoryRouteRepository` — cambio de comportamiento sutil pero correcto y más determinista, cubierto por los propios AC (AC-007/AC-010) y por el hecho de que `app.element.ts` sigue excluido de coverage (sin test unitario propio, como ya era el caso).
  - **`src/shared/repositories/memory-route.repository.ts`** — nuevo método público `seed()`. No modifica `save()`/`getAll()`/etc. existentes; 100% cobertura en el método nuevo, sin romper ningún test de contrato (`route.repository.spec.ts` sigue en verde).
  - **`src/shared/photo-capture/photo-capture.element.ts`** — nueva propiedad pública `limitReached` (getter/setter + atributo reflejado). Cambia el `aria-label`/`title` del botón bajo una nueva condición; no cambia el comportamiento por defecto (`limitReached` por defecto `false`, mismo texto "Añadir foto" que antes). Usado ya por dos consumidores (`route-detail`, `cockpit`), ambos con tests dedicados.
  - **`src/shared/services/photo-capture-adapter.service.ts`** — `captureFromInput()` ahora adjunta el `<input type="file">` al DOM (antes vivía solo en memoria). Riesgo real si el `input.remove()` no se ejecutase en algún camino: dejaría inputs invisibles acumulándose en `document.body`. Verificado: se retira tanto en `change` como en `cancel`, con tests explícitos que lo comprueban (`photo-capture-adapter.service.spec.ts`) y sin regresión en los tests de captura ya existentes.

  Ningún cambio en estos archivos rompe tests existentes (567/567 Vitest en verde, confirmado por ejecución real en esta revisión) ni cambia comportamiento observable en producción salvo lo explícitamente pedido por los AC (límite de 100 fotos).

### Actualizaciones Core
- ✅ Ninguna actualización de TypeScript/Vite/ESLint/Tauri. La única dependencia nueva es `start-server-and-test@^3.0.11` (devDependency, con sus transitivas en `pnpm-lock.yaml`) — coherente con AC-006 y la nota del plan de que es "la única dependencia nueva de todo este plan".

### Normas Saltadas
- ⚠️ **`CLAUDE.md` modificado sin autorización explícita visible.** El working tree incluye un cambio a `CLAUDE.md` (consolidación de la regla `data-cy` obligatoria bajo "Convenciones de Frontend" + referencia cruzada desde "Tests E2E") que **no aparece en ningún paso del plan** (`specs/features/cobertura-e2e.plan.md`) ni tiene ADR/nota asociada. El propio `CLAUDE.md` exige explícitamente: *"No modificar este CLAUDE.md... sin avisar primero — son la definición del propio workflow"*. El contenido del cambio en sí es razonable (documenta una convención que, de hecho, ya se está aplicando en esta misma feature con los nuevos `data-cy`), pero la regla de "avisar primero" es procedimental, no de contenido — esta revisión no tiene visibilidad de si hubo aviso/aprobación fuera de este historial de archivos. Ver ISSUE-002.
- ⚠️ **Documentación prometida por el plan no entregada.** El Paso 8 del plan (`[x]`) incluye explícitamente `MODIFICAR docs/07-cypress-e2e.md` como parte de sus "Archivos a crear/modificar", y las notas de implementación de `AC-012` describen la sección a añadir. `docs/07-cypress-e2e.md` no tiene ningún cambio en el working tree. El paso está marcado como completado en el plan sin que esta parte concreta se haya ejecutado. Ver ISSUE-001.

## ⚠️ Issues Encontrados

### ISSUE-001: `docs/07-cypress-e2e.md` no se actualizó pese a que el plan (Paso 8) y AC-012 lo exigen — RESUELTO
- **Severidad**: BAJA
- **AC afectado**: AC-012
- **Descripción**: El plan especifica textualmente `MODIFICAR docs/07-cypress-e2e.md` con una nueva sección "Siembra de datos en Moto Routes" documentando `cy.visitWithSeed()` y el mecanismo de siembra de fotos vía `moto-routes-photos`. El archivo real no tenía ningún cambio; la documentación equivalente solo vivía como comentario JSDoc en `cypress/support/commands.ts`. El mecanismo en sí funcionaba correctamente y estaba probado (`fotos.cy.ts`, `timeline.cy.ts`), así que no había riesgo funcional — era puramente un gap de documentación.
- **Resolución**: Añadida la sección "Siembra de datos en Moto Routes" a `docs/07-cypress-e2e.md` (antes de "Requisitos para Componentes"), documentando `cy.visitWithSeed()`, la clave `cypress-seed-routes` y la reutilización de `moto-routes-photos`. AC-012 marcado `[x]` en la spec. Suite completa reverificada tras el cambio: 567/567 Vitest en verde.

### ISSUE-002: `CLAUDE.md` modificado sin que el plan lo contemple ni haya evidencia de aviso previo — RESUELTO
- **Severidad**: MEDIA
- **AC afectado**: Ninguno directamente — incumplimiento de una norma de gobernanza del propio proyecto, no de un criterio de aceptación.
- **Descripción**: `git diff CLAUDE.md` muestra 2 cambios: (1) añade la frase completa de la regla `data-cy` obligatoria bajo "Convenciones de Frontend" (antes solo existía, más resumida, bajo "Tests E2E"); (2) simplifica la entrada correspondiente de "Tests E2E" para referenciar la anterior en vez de duplicarla. Ni el plan ni la spec de esta feature mencionan tocar `CLAUDE.md`.
- **Resolución**: Confirmado explícitamente con el usuario (pregunta directa tras esta revisión) que el cambio se mantiene — el contenido es coherente (elimina una duplicación real de la misma regla) y de bajo riesgo. Aviso y confirmación quedan documentados en el historial de la sesión.

## 📊 Veredicto
- [x] APPROVED
- [ ] APPROVED WITH MINOR ISSUES
- [ ] CHANGES REQUESTED
- [ ] BLOCKED

**Justificación**: Los 45 AC están implementados con evidencia verificada de forma independiente en esta revisión (no solo aceptando el resumen recibido): `tsc --noEmit` limpio, `eslint src/` sin errores, 567/567 Vitest en verde, 30/30 Cypress en verde (ejecución real de `pnpm run test:e2e` durante esta revisión), cobertura muy por encima del umbral del 80% y 100% en los archivos nuevos clave. No hay hallazgos de seguridad ni regresiones en componentes compartidos — los cambios en `PhotoCaptureElement`, `MemoryRouteRepository` y `app.element.ts` son aditivos, con tests dedicados, y no rompen ningún test/contrato existente. Los dos issues menores detectados durante la revisión (ISSUE-001, documentación; ISSUE-002, gobernanza sobre `CLAUDE.md`) se resolvieron en la misma sesión: la documentación se completó y verificó, y el cambio a `CLAUDE.md` fue confirmado explícitamente por el usuario. Feature `cobertura-e2e` cerrado.
