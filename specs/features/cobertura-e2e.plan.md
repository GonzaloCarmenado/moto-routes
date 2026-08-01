# Plan de Implementación: Cobertura E2E real con Cypress

> Sin ADR pendiente: todas las decisiones de arquitectura que este plan necesita ya están tomadas (ADR-020/ADR-023 patrón insertar-activa/actualizar-al-parar, ADR-025 `cockpit-save-route-dialog`, ADR-027 aún "Propuesta" sobre OpenSpec pero no bloquea — esta spec sigue el flujo SDD propio vigente). No se requiere registrar ningún ADR nuevo antes de implementar.

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Reparar `cockpit.cy.ts` + `data-cy="cockpit-speed-value"` | `cockpit.cy.ts`, `cockpit.render.ts` (+spec) | AC-001, AC-002, AC-003, AC-004 | Small |
| 2 | Scripts npm de Cypress + `start-server-and-test` | `package.json` | AC-005, AC-006 | Small |
| 3 | Nuevos `data-cy`: `route-card` y `route-list-empty` | `route-list.element.ts` (+spec) | AC-039, AC-040 | Small |
| 4 | `data-cy="photo-capture-input-file"` localizable en el DOM | `photo-capture-adapter.service.ts` (+spec) | AC-038 | Small |
| 5 | Tipos + parseo puro de la siembra de rutas | `app-seed.types.ts`, `app-seed.transform.ts` (+spec) | AC-011 | Small |
| 6 | `MemoryRouteRepository.seed()` — carga directa sin `save()` | `memory-route.repository.ts` (+spec) | soporte de AC-008 | Small |
| 7 | `applyCypressSeed()` + integración en `app.element.ts` | `app-seed.service.ts` (+spec), `app.element.ts` | AC-007, AC-008, AC-009, AC-010 | Medium |
| 8 | Infraestructura Cypress: `supportFile`, comandos de siembra, doc. de fotos | `cypress.config.ts`, `cypress/support/*`, `docs/07-cypress-e2e.md` | AC-012 | Medium |
| 9 | `MAX_PHOTOS_PER_ROUTE` + propiedad `limitReached` en `<photo-capture>` | `photo-capture.types.ts`, `photo-capture.limit.ts` (+spec), `photo-capture.element.ts` (+spec) | AC-041, AC-042, AC-043 | Medium |
| 10 | Wiring del límite en `<route-detail>` | `route-detail.element.ts` (+spec) | AC-041, AC-043, AC-044, AC-045 | Small |
| 11 | Wiring del límite en `<cockpit-view>` | `cockpit.element.ts` (+spec) | AC-041, AC-043, AC-044, AC-045 | Small |
| 12 | Cypress: flujo cockpit (grabación completa) | `cypress/e2e/cockpit/cockpit.cy.ts` | AC-013 a AC-018 | Medium |
| 13 | Cypress: flujo route-list | `cypress/e2e/route-list/route-list.cy.ts` | AC-019 a AC-022 | Small |
| 14 | Cypress: flujo route-detail (navegación, pestañas, notas) | `cypress/e2e/route-detail/route-detail.cy.ts` | AC-023 a AC-028 | Medium |
| 15 | Cypress: flujo fotos + verificación E2E del límite de 100 | `cypress/e2e/fotos/fotos.cy.ts` | AC-029 a AC-034, AC-041 a AC-045 | Medium |
| 16 | Cypress: flujo timeline | `cypress/e2e/route-detail/timeline.cy.ts` | AC-035 a AC-037 | Small |

**Orden de ejecución**: Pasos 1-4 son independientes entre sí (paralelizables). Paso 5→6→7 es una cadena estricta (tipos→repositorio→wiring). Paso 8 depende de 5-7 (los custom commands de Cypress asumen que `cypress-seed-routes` ya funciona). Pasos 9→10→11 es una cadena estricta (constante/propiedad→cada consumidor). Pasos 12-16 dependen de que 1-11 estén terminados, pero son paralelizables entre sí (cada uno es un fichero de spec Cypress distinto, sin dependencias cruzadas).

---

## Paso 1: Reparar `cockpit.cy.ts` + `data-cy="cockpit-speed-value"` [x]

- **Objetivo**: Quitar el test roto de "Modo Invisible" (funcionalidad retirada), sustituir el selector CSS `.speed-display .speed-value` por `data-cy`, y añadir ese `data-cy` al nodo real en `cockpit.render.ts`.
- **AC cubiertos**: AC-001, AC-002, AC-003, AC-004.
- **Tests a escribir**:
  - Vitest (antes del cambio en `cockpit.render.ts`): `buildSpeedDisplay('0')` devuelve un nodo `.speed-value` con `data-cy="cockpit-speed-value"` → Valida AC-003.
  - Cypress (edición directa del spec, es en sí mismo el "test" de este paso — no hay unidad intermedia): los 3 `it()` que quedan (estado inicial, cambio a "finalizar" al grabar, pausa habilitada) usan `[data-cy="cockpit-speed-value"]` en vez del selector CSS → Valida AC-001, AC-002, AC-004.
- **Archivos a crear/modificar**:
  - `MODIFICAR cypress/e2e/cockpit/cockpit.cy.ts` — quitar `it('should toggle invisible mode', ...)` completo; cambiar `cy.get('.speed-display .speed-value')` por `cy.get('[data-cy="cockpit-speed-value"]')`.
  - `MODIFICAR src/cockpit/cockpit.render.ts` — en `buildSpeedDisplay()`, añadir `data-cy="cockpit-speed-value"` al `<div class="num speed-value">`.
  - `MODIFICAR src/cockpit/cockpit.render.spec.ts` — nueva aserción sobre el `data-cy`.
- **Notas**:
  - No tocar `updateLiveDisplay()` — sigue usando `root.querySelector('.speed-value')` (selector de clase interno, no un `data-cy`; ese `querySelector` es código de producción, no un test Cypress, así que la regla de "nunca selectores de clase en tests" no aplica aquí).
  - Confirmar manualmente (o con `pnpm run cy:run` una vez el Paso 2 esté hecho) que los 3 tests restantes pasan en verde contra el código actual, sin tocar más contenido del que exige AC-004.

---

## Paso 2: Scripts npm de Cypress + `start-server-and-test` [x]

- **Objetivo**: Añadir los scripts npm que hoy faltan para poder ejecutar Cypress, y la dependencia que los sostiene.
- **AC cubiertos**: AC-005, AC-006.
- **Tests a escribir**: Ninguno (cambio de configuración, no de código ejecutable). Verificación: ejecutar `pnpm run cy:run` tras este paso y confirmar que arranca Cypress (aunque falle si el Paso 1 no está aplicado ya).
- **Archivos a crear/modificar**:
  - `MODIFICAR package.json` — añadir a `scripts`: `"cy:open": "cypress open"`, `"cy:run": "cypress run"`, `"test:e2e": "start-server-and-test dev http://localhost:1420 cy:run"`. Añadir a `devDependencies`: `"start-server-and-test": "^2.x"`.
- **Notas**:
  - `pnpm add -D start-server-and-test` es la única dependencia nueva de todo este plan — mínima, ya usada en el ejemplo de referencia de `docs/07-cypress-e2e.md`.
  - No añadir `cy:run:headless` ni variantes por dominio (`cy:run:clientes` del ejemplo genérico) — la spec solo pide `cy:open`/`cy:run`/`test:e2e`, y añadir scripts no pedidos es ruido innecesario.

---

## Paso 3: Nuevos `data-cy`: `route-card` y `route-list-empty` [x]

- **Objetivo**: Dar `data-cy` propio al contenedor completo de cada tarjeta de `<route-list>` (hoy solo sus botones internos lo tienen) y al estado vacío del listado.
- **AC cubiertos**: AC-039, AC-040.
- **Tests a escribir** (en `route-list.element.spec.ts`, ampliando el describe existente):
  - Test: con N rutas, cada tarjeta renderizada tiene `data-cy="route-card"` → Valida AC-039.
  - Test: con 0 rutas, el contenedor de estado vacío tiene `data-cy="route-list-empty"` y no aparece ningún `data-cy="route-card"` → Valida AC-040.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/list/route-list.element.ts` — en `buildCard()`: `card.setAttribute('data-cy', 'route-card')`. En `buildBody()`: `empty.setAttribute('data-cy', 'route-list-empty')`.
  - `MODIFICAR src/routes/list/route-list.element.spec.ts`.
- **Notas**: No cambiar la clase CSS existente (`.route-card`/`.route-list__empty`) — `data-cy` es un atributo adicional, coexiste con la clase que ya usan los estilos.

---

## Paso 4: `data-cy="photo-capture-input-file"` localizable en el DOM [x]

- **Objetivo**: `captureFromInput()` hoy crea el `<input type="file">` y llama `.click()` sin insertarlo en el DOM — funciona en producción, pero Cypress no puede localizar (ni hacer `cy.selectFile()` sobre) un elemento fuera del árbol del documento. Se adjunta temporalmente, oculto sin alterar el layout, y se retira al resolver (con archivos o cancelación).
- **AC cubiertos**: AC-038.
- **Tests a escribir** (en `photo-capture-adapter.service.spec.ts`, ampliando los describe de `captureFromCamera`/`pickFromGallery` ya existentes):
  - Test: mientras la promesa de `captureFromCamera()`/`pickFromGallery()` está pendiente, `document.body.querySelector('[data-cy="photo-capture-input-file"]')` encuentra el input → Valida AC-038 (localizable).
  - Test: tras disparar `change` con archivos, el input ya no está en `document.body` → Valida AC-038 (se retira al resolver con archivos).
  - Test: tras disparar `cancel`, el input tampoco está en `document.body` → Valida AC-038 (se retira también al cancelar).
  - Test (regresión): el resultado devuelto (`File`/`File[]`) sigue siendo correcto tras el cambio — reutiliza las aserciones ya existentes en los tests de `captureFromCamera`/`pickFromGallery`, ahora con el input insertado en el DOM real en vez de solo creado en memoria → Valida que no cambia el comportamiento de producción.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/services/photo-capture-adapter.service.ts` — en `captureFromInput()`: `input.setAttribute('data-cy', 'photo-capture-input-file')`; ocultar con estilos que no alteren el layout (`position: fixed; opacity: 0; width: 0; height: 0; pointer-events: none;` — no `display: none`, que en algunos navegadores impide que `.click()` abra el selector nativo); `document.body.appendChild(input)` antes de `.click()`; `input.remove()` tanto en el listener de `change` como en el de `cancel`.
  - `MODIFICAR src/shared/services/photo-capture-adapter.service.spec.ts`.
- **Notas**:
  - No usar `display: none` — algunos navegadores/WebViews ignoran `.click()` sobre inputs con `display: none`; el patrón `position: fixed; opacity: 0` es el estándar para inputs de archivo invisibles pero funcionales.
  - Cypress necesitará `{ force: true }` al usar `cy.get('[data-cy="photo-capture-input-file"]').selectFile(...)` porque el input, aunque presente en el DOM, no es "visible" en el sentido que exige Cypress por defecto — documentarlo en el Paso 15.

---

## Paso 5: Tipos + parseo puro de la siembra de rutas [x]

- **Objetivo**: Definir la forma del JSON de `cypress-seed-routes` y una función pura que lo valide/parsee, sin tocar `localStorage` ni el DOM — la única pieza de este mecanismo con lógica de decisión real, por eso es la que necesita más casos de test.
- **AC cubiertos**: AC-011 (soporte estructural de AC-007 a AC-010, implementados en el Paso 7).
- **Tests a escribir** (en `app-seed.transform.spec.ts`, antes de implementar):
  - JSON válido con `routes` (2 elementos), `points` y `stops` → devuelve el objeto tal cual, tipado → Valida AC-011 (caso "JSON válido con rutas+puntos+paradas").
  - `raw === null` (clave ausente en `localStorage`) → devuelve `null` → Valida AC-011 (caso "clave ausente") y soporta AC-009.
  - `raw` no es JSON válido (`"{not json"`) → devuelve `null` sin lanzar excepción → Valida AC-011 (caso "JSON corrupto") y soporta AC-009.
  - JSON válido pero sin la clave `routes`, o `routes` no es un array → devuelve `null` → Valida AC-011 (caso "sin `routes`") y soporta AC-009.
  - JSON válido con `routes: []` (array vacío) → devuelve `{ routes: [], points: undefined, stops: undefined }` (un array vacío es válido, no es lo mismo que "ausente") → Valida AC-011 (caso "`routes` vacío").
  - JSON válido con solo `routes` (sin `points` ni `stops`) → `points`/`stops` quedan `undefined`, sin lanzar excepción → Valida el carácter opcional de esos campos (AC-008).
- **Archivos a crear/modificar**:
  - `CREAR src/app/app-seed.types.ts` — `export interface CypressSeedData { routes: Route[]; points?: Record<string, RoutePoint[]>; stops?: Record<string, RouteStop[]>; }` (usa los tipos de `shared/models/route.types.ts`, tal como pide AC-008).
  - `CREAR src/app/app-seed.transform.ts` — `export function parseCypressSeed(raw: string | null): CypressSeedData | null`.
  - `CREAR src/app/app-seed.transform.spec.ts`.
  - `MODIFICAR vitest.config.ts` — añadir `'src/app/app-seed.types.ts'` a `coverage.exclude` (mismo criterio que `route-timeline.types.ts`, contrato puro sin código ejecutable).
- **Notas**:
  - `parseCypressSeed()` es la única función de este paso con lógica — debe envolver el `JSON.parse()` en `try/catch` y validar con guardas explícitas (`typeof`, `Array.isArray`) en vez de un `as CypressSeedData` sin comprobar, para no violar `no-explicit-any`/`no-unsafe-assignment` de ESLint strict al leer un `unknown` recién parseado.
  - No valida aquí el contenido interno de cada `Route`/`RoutePoint`/`RouteStop` (campos individuales) — la spec no lo pide (AC-008/AC-009 hablan de la forma general `{ routes, points?, stops? }`, no de validar cada campo de cada ruta) y añadir esa validación sería inventar un AC no pedido.

---

## Paso 6: `MemoryRouteRepository.seed()` — carga directa sin pasar por `save()` [x]

- **Objetivo**: Método que puebla los `Map` internos de `MemoryRouteRepository` directamente con rutas/puntos/paradas ya "guardados", preservando el orden esperado por `getAll()` — sin pasar por la lógica de upsert de `save()`, pensada para el flujo normal de grabación (ADR-020).
- **AC cubiertos**: Ninguno directamente — soporte estructural de AC-008, implementado end-to-end en el Paso 7.
- **Tests a escribir** (en `memory-route.repository.spec.ts`, en un nuevo `describe('MemoryRouteRepository.seed()', ...)` junto al `createRouteSuite(...)` ya existente — este método no es parte de `IRouteRepository`, así que se testea directamente sobre la clase concreta, no vía el contrato compartido):
  - `seed()` con 2 rutas completas (con `id`/`createdAt` propios) + `points`/`stops` para ambas: `getAll()` devuelve las 2 rutas; `getPointsByRouteId`/`getStopsByRouteId` devuelven los arrays sembrados para cada una.
  - `seed()` con rutas pero sin `points`/`stops` (parámetros omitidos): `getPointsByRouteId`/`getStopsByRouteId` devuelven `[]` para esas rutas, sin lanzar excepción.
  - `seed()` con `routes: []`: `getAll()` sigue devolviendo `[]` (no rompe el repositorio recién creado).
  - `getAll()` tras `seed()` respeta el mismo orden (createdAt desc, empate por inserción) que ya usa `save()` — reutilizando fixtures con `createdAt` explícitos para verificarlo.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/repositories/memory-route.repository.ts` — nuevo método público `seed(routes: Route[], pointsByRouteId?: Record<string, RoutePoint[]>, stopsByRouteId?: Record<string, RouteStop[]>): void`.
  - `MODIFICAR src/shared/repositories/memory-route.repository.spec.ts`.
- **Notas**:
  - Implementación: por cada `route` en `routes`, `this.routes.set(route.id, route)` y `this.orderMap.set(route.id, this.insertOrder++)` (mismo patrón que `save()` usa para rutas nuevas); `this.points.set(route.id, pointsByRouteId?.[route.id] ?? [])` y análogo para `stops` — sin generar nuevos `id` (las rutas sembradas ya traen el suyo, a diferencia de `save()`, que genera uno si falta).
  - No se añade `seed()` a `IRouteRepository` — es un método específico de la implementación en memoria, sin sentido en `SqliteRouteRepository` (el mecanismo de siembra está excluido por diseño de cualquier entorno Tauri real, AC-010). Añadirlo a la interfaz obligaría a `SqliteRouteRepository` a implementar un método que nunca usaría.

---

## Paso 7: `applyCypressSeed()` + integración en `app.element.ts` [x]

- **Objetivo**: Función que ata todo lo anterior — lee `localStorage`, guarda con `isTauri()` como guarda explícita (no depender de que `createSqliteDb()` falle, para que el comportamiento sea determinista tal como pide la spec), parsea con `parseCypressSeed()` y, si es válido, llama a `repo.seed(...)`. Se integra en `app.element.ts` reestructurando `init()` para decidir primero por `isTauri()` en vez de por éxito/fracaso del intento de SQLite.
- **AC cubiertos**: AC-007, AC-008, AC-009, AC-010.
- **Tests a escribir** (en `app-seed.service.spec.ts`, mockeando `localStorage`/`window.__TAURI_INTERNALS__`/un `MemoryRouteRepository` real o un spy sobre `.seed()`):
  - `isTauri()` `false` + `localStorage` con JSON válido de 2 rutas → `repo.seed()` se llama con los datos parseados → Valida AC-008.
  - `isTauri()` `false` + `localStorage` sin la clave `cypress-seed-routes` → `repo.seed()` NO se llama, sin lanzar excepción → Valida AC-009.
  - `isTauri()` `false` + `localStorage` con JSON corrupto → `repo.seed()` NO se llama, sin lanzar excepción → Valida AC-009.
  - `isTauri()` `false` + `localStorage` con JSON válido pero `routes` vacío → `repo.seed()` NO se llama (o se llama con `[]`, sin efecto visible) → Valida AC-009 (coherente con el Paso 5).
  - `isTauri()` `true` (mock de `window.__TAURI_INTERNALS__`) + `localStorage` con la clave `cypress-seed-routes` presente y válida → `localStorage.getItem` NUNCA se invoca (spy) y `repo.seed()` tampoco se llama → Valida AC-010.
- **Archivos a crear/modificar**:
  - `CREAR src/app/app-seed.service.ts` — `export function applyCypressSeed(repo: MemoryRouteRepository): void`.
  - `CREAR src/app/app-seed.service.spec.ts`.
  - `MODIFICAR src/app/app.element.ts` — reestructurar `init()`.
- **Notas**:
  - Cambio en `app.element.ts` (diff mínimo, sin nuevo test sobre este archivo — sigue excluido de `coverage` en `vitest.config.ts` y sin `app.element.spec.ts`, igual que hoy):
    ```ts
    private async init(): Promise<void> {
      if (isTauri()) {
        try {
          const sqliteDb = await createSqliteDb();
          this.repo = new SqliteRouteRepository(sqliteDb);
        } catch {
          this.repo = new MemoryRouteRepository();
        }
      } else {
        const memRepo = new MemoryRouteRepository();
        applyCypressSeed(memRepo);
        this.repo = memRepo;
      }
      this.render();
    }
    ```
    Nótese que esto invierte la rama de decisión original (antes: intentar SQLite siempre, caer a memoria si falla) por una explícita sobre `isTauri()` — así el seeding es determinista y no depende de que `createSqliteDb()` falle "por casualidad" en el navegador de pruebas (nota de implementación explícita de la spec).
  - `applyCypressSeed()` incluye su propia guarda `if (isTauri()) return;` **redundante** con la de `app.element.ts` — es intencional (defensa en profundidad, mismo criterio que ADR-023 con `PRAGMA foreign_keys`): así AC-010 queda cubierto por un test unitario real sobre una función pura, sin depender de que alguien añada algún día un `app.element.spec.ts` (que hoy no existe y sigue sin ser necesario tras este paso — toda la lógica de decisión vive en funciones testeables de `src/app/app-seed.*`).
  - Import nuevo en `app.element.ts`: `isTauri` desde `../shared/services/photo-capture-adapter.service.js` (única fuente de verdad de detección de entorno, tal como exige AC-007) y `applyCypressSeed` desde `./app-seed.service.js`.
  - AC-008/AC-009 reciben además verificación end-to-end real en el Paso 13 (`route-list.cy.ts`, que siembra rutas de verdad y comprueba que aparecen, y comprueba el estado vacío sin siembra) — no es necesario repetir esas aserciones aquí, solo la lógica de guarda/parseo aislada.

---

## Paso 8: Infraestructura Cypress — `supportFile`, comandos de siembra, documentación de fotos [x]

- **Objetivo**: Activar `supportFile` (hoy `false`) para centralizar en un único sitio el helper de siembra que se repetirá en los Pasos 12-16, en vez de duplicar `localStorage.setItem(...)` en cada spec. De paso, engancha `@testing-library/cypress` (ya en `devDependencies` desde hace tiempo, pero huérfano — nunca se importó porque no había `supportFile`).
- **AC cubiertos**: AC-012.
- **Tests a escribir**: Ninguno en Vitest (es infraestructura de Cypress, no código de producción). Verificación: un spec mínimo de humo (`cypress/e2e/seed/seed-smoke.cy.ts` — opcional, puede omitirse si el Paso 13 ya ejercita `cy.visitWithSeed()` de inmediato) confirma que `cy.visitWithSeed({...})` deja rutas visibles.
- **Archivos a crear/modificar**:
  - `MODIFICAR cypress.config.ts` — `supportFile: 'cypress/support/e2e.ts'` (antes `false`).
  - `CREAR cypress/support/e2e.ts` — `import '@testing-library/cypress/add-commands'; import './commands.js';`
  - `CREAR cypress/support/commands.ts` — comando `cy.visitWithSeed(options)`:
    ```ts
    export interface SeedRoute { /* subconjunto mínimo de Route + id explícito */ }
    export interface VisitWithSeedOptions {
      routes?: SeedRoute[];
      points?: Record<string, unknown[]>;
      stops?: Record<string, unknown[]>;
      photos?: unknown[];
      path?: string; // por defecto '/'
    }
    Cypress.Commands.add('visitWithSeed', (options: VisitWithSeedOptions = {}) => {
      cy.visit(options.path ?? '/', {
        onBeforeLoad(win) {
          if (options.routes?.length) {
            win.localStorage.setItem('cypress-seed-routes', JSON.stringify({
              routes: options.routes, points: options.points, stops: options.stops,
            }));
          }
          if (options.photos?.length) {
            win.localStorage.setItem('moto-routes-photos', JSON.stringify(options.photos));
          }
        },
      });
    });
    ```
  - `CREAR cypress/support/index.d.ts` (o `declare global` al final de `commands.ts`) — `declare global { namespace Cypress { interface Chainable { visitWithSeed(options?: VisitWithSeedOptions): Chainable<void>; } } }`.
  - `MODIFICAR docs/07-cypress-e2e.md` — nueva sección "Siembra de datos en Moto Routes" documentando: (a) `cy.visitWithSeed()` para rutas (clave `cypress-seed-routes`, vía `onBeforeLoad` para garantizar que se escribe antes de que `app.element.ts` arranque); (b) que las fotos se siembran con la misma clave real `moto-routes-photos` que ya lee `MemoryPhotoRepository` en cada instancia nueva, sin mecanismo de producción nuevo (AC-012) — solo el mismo `onBeforeLoad`.
- **Notas**:
  - `onBeforeLoad` es imprescindible (no `cy.window().then(win => win.localStorage.setItem(...))` tras un `cy.visit()` normal) porque `app.element.ts` lee `localStorage` de forma síncrona nada más cargar el módulo — si se escribe la clave después de que la página ya haya empezado a ejecutar su JS, llega tarde.
  - `cy.visitWithSeed({})` sin argumentos (o sin `routes`) equivale a `cy.visit('/')` normal — útil para los escenarios de "sin siembra" (AC-009, AC-020 con estado vacío de fotos, AC-037 timeline vacío).
  - Cada test que necesite un `id` de ruta conocido (para asociar fotos o para navegar directamente) genera su propio UUID con `crypto.randomUUID()` en el propio `it()` (disponible en Node/navegador) y lo usa tanto en el `routes: [{ id, ... }]` sembrado como en `photos: [{ routeId: id, ... }]` — mismo criterio de "tests autocontenidos" de `docs/07-cypress-e2e.md`.
  - No se crea ningún fixture JSON nuevo en `cypress/fixtures/` para este paso — los datos de siembra se construyen inline en cada spec (más legible al ver qué se afirma después), siguiendo el ejemplo ya usado en `cypress/fixtures/gps-data.json` solo si un spec concreto lo necesita (Paso 12, si se reutiliza para simular puntos GPS reales — decisión del impl-agent en ese paso).

---

## Paso 9: `MAX_PHOTOS_PER_ROUTE` + propiedad `limitReached` en `<photo-capture>` [x]

- **Objetivo**: Constante compartida (evita que "100" quede duplicado y diverja entre `route-detail` y `cockpit`) y una propiedad nueva en `PhotoCaptureElement` que, a diferencia de `disabled` (genérico) y `loading` (transitorio), comunica específicamente "límite alcanzado" en el texto accesible — sin sobrecargar la semántica de `disabled` para inferir el motivo.
- **AC cubiertos**: AC-041 (unidad: el componente refleja `disabled` cuando el padre se lo asigna — ya soportado hoy, sin cambios), AC-042, AC-043 (unidad).
- **Tests a escribir**:
  - En `photo-capture.element.spec.ts` (ampliando el describe existente):
    - Por defecto, `el.limitReached` es `false` y el botón tiene `aria-label="Añadir foto"` → Valida AC-043 (estado por debajo del límite).
    - `el.limitReached = true` (sin `disabled`) cambia `aria-label`/`title` del botón a "Límite de fotos alcanzado" → Valida AC-042.
    - `el.loading = true` (sin `limitReached`) mantiene `aria-label="Añadir foto"` (no confundir con el mensaje de límite) → Valida AC-042 ("diferenciable del estado transitorio loading").
    - `el.limitReached = true` refleja el atributo `limit-reached` en el DOM (mismo patrón que `disabled`/`loading`) → Valida el mecanismo de reflejo.
    - Creado con `limitReached` ya asignado a `true` **antes** de insertarse en el DOM (mismo patrón que el test ya existente de `disabled`), el `render()` inicial ya muestra la etiqueta de límite, sin depender de un `attributeChangedCallback` posterior → Valida AC-042 en el caso de montaje con el estado ya conocido de antemano (el caso real de uso en los Pasos 10/11).
  - En un nuevo `photo-capture.limit.spec.ts`:
    - `applyPhotoCaptureLimit(el, 99)` dentro del límite → `el.disabled === false`, `el.limitReached === false` → Valida AC-043.
    - `applyPhotoCaptureLimit(el, 100)` en el límite → `el.disabled === true`, `el.limitReached === true` → Valida AC-041/AC-042.
    - `applyPhotoCaptureLimit(el, 150)` por encima del límite (defensivo) → mismo resultado que en 100.
    - `applyPhotoCaptureLimit(null, 100)` no lanza excepción (no-op) → cubre el caso `_photoCaptureEl`/`this.photoCaptureEl` nulo en los Pasos 10/11.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/photo-capture/photo-capture.types.ts` — `export const MAX_PHOTOS_PER_ROUTE = 100;`.
  - `CREAR src/shared/photo-capture/photo-capture.limit.ts` — `export function applyPhotoCaptureLimit(el: PhotoCaptureElement | null, photoCount: number): void`.
  - `CREAR src/shared/photo-capture/photo-capture.limit.spec.ts`.
  - `MODIFICAR src/shared/photo-capture/photo-capture.element.ts` — nueva propiedad `limitReached` (getter/setter + `observedAttributes` + `attributeChangedCallback`, mismo patrón exacto que `disabled`/`loading`); `updateButtonState()` calcula la etiqueta (`this._limitReached ? 'Límite de fotos alcanzado' : 'Añadir foto'`) y la aplica a `aria-label`/`title`; el `render()` inicial calcula esa misma etiqueta a partir de `this._limitReached` (igual que ya hace hoy con `disabledAttr`), para que el montaje con el estado ya conocido de antemano (Pasos 10/11) no dependa de un ciclo de atributo posterior.
  - `MODIFICAR src/shared/photo-capture/photo-capture.element.spec.ts`.
- **Notas**:
  - `MAX_PHOTOS_PER_ROUTE` vive en `photo-capture.types.ts` (no en `IPhotoRepository`/`shared/models/photo.repository.ts`) porque tanto `route-detail.element.ts` como `cockpit.element.ts` **ya** importan de `shared/photo-capture/photo-capture.types.js` (para `PHOTO_CAPTURE_EVENT`) — cero imports cruzados nuevos entre dominios.
  - `applyPhotoCaptureLimit()` es el único punto que decide `disabled`/`limitReached` a la vez — evita que un futuro tercer llamador ponga `disabled` sin `limitReached` (o viceversa) y deje el texto accesible inconsistente con el estado real del botón.
  - No se toca `countByRouteId()` de `IPhotoRepository` — sigue existiendo con sus tests de contrato propios, simplemente no se usa aquí (los Pasos 10/11 reutilizan el array ya cargado, tal como fija la spec).

---

## Paso 10: Wiring del límite en `<route-detail>` [x]

- **Objetivo**: Que `buildAddPhotoButton()` calcule el estado de límite a partir de `this._photos.length` en el momento de construirse — como el botón se reconstruye por completo en cada `rerenderPhotosSection()` (tras añadir/borrar una foto), este único punto cubre montaje inicial, alta y baja sin lógica adicional de sincronización.
- **AC cubiertos**: AC-041, AC-043, AC-044, AC-045 (contexto pestaña "Fotos" de `route-detail`).
- **Tests a escribir** (en `route-detail.element.spec.ts`, ampliando el describe de fotos ya existente):
  - Ruta con 100 fotos ya cargadas (vía `MemoryPhotoRepository`/mock del repo): al abrir/renderizar la pestaña "Fotos", `<photo-capture>` tiene `disabled` en el DOM (`el.hasAttribute('disabled')`) → Valida AC-041.
  - Ruta con 99 fotos: `<photo-capture>` NO tiene `disabled` → Valida AC-043.
  - Ruta con 99 fotos: se añade una foto más (vía el flujo real de `handleAddPhoto`/`persistSinglePhoto`, mockeando `captureFromCamera`/`pickFromGallery` para devolver un `File`) → tras el refresco, la nueva instancia de `<photo-capture>` en el DOM tiene `disabled` → Valida AC-044.
  - Ruta con 100 fotos y el botón deshabilitado: se borra una foto (vía `handleDeletePhoto`, confirmando el `<confirm-dialog>`) → tras el refresco, `<photo-capture>` ya NO tiene `disabled` → Valida AC-045.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/detail/route-detail.element.ts` — en `buildAddPhotoButton()`, tras crear `photoCapture`, `applyPhotoCaptureLimit(photoCapture, this._photos.length)`.
  - `MODIFICAR src/routes/detail/route-detail.element.spec.ts`.
- **Notas**:
  - Import nuevo: `applyPhotoCaptureLimit` desde `../../shared/photo-capture/photo-capture.limit.js`.
  - No hace falta ningún campo nuevo ni llamada adicional al repositorio — `this._photos` ya está actualizado en todos los puntos donde `buildAddPhotoButton()`/`buildPhotosSection()` se invocan (`fetchAndRender()`, `refreshAllPanels()` tras alta/baja), tal como documenta la spec.

---

## Paso 11: Wiring del límite en `<cockpit-view>` [x]

- **Objetivo**: A diferencia de `route-detail` (que reconstruye el botón en cada cambio), `cockpit-view` reutiliza la misma instancia de `<photo-capture>` mientras la grabación está activa y solo refresca `this.galleryEl.photos` — hay que llamar a `applyPhotoCaptureLimit()` explícitamente cada vez que esa lista cambia (montaje inicial vía `refreshGallery()`, alta vía `handlePhotoCapture()`, baja vía `handleDeletePhoto()`).
- **AC cubiertos**: AC-041, AC-043, AC-044, AC-045 (contexto galería del cockpit durante grabación activa).
- **Tests a escribir** (en `cockpit.element.spec.ts`, ampliando el describe de fotos ya existente):
  - Grabación activa con 100 fotos ya devueltas por `fetchGalleryPhotos` (mock): tras `refreshGallery()`, `this.photoCaptureEl` (o su nodo en el DOM) tiene `disabled` → Valida AC-041.
  - Grabación activa con 99 fotos: `<photo-capture>` no está deshabilitado → Valida AC-043.
  - Grabación activa con 99 fotos: se captura una foto más (mock de `captureFromCamera`/`pickFromGallery` + `processMultiplePhotos` devolviendo `addedCount: 1`) → tras `refreshGallery()`, el botón queda deshabilitado sin recargar → Valida AC-044.
  - Grabación activa con 100 fotos y botón deshabilitado: se borra una foto vía `handleDeletePhoto` → el botón se rehabilita → Valida AC-045.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts` — en `refreshGallery(routeId)`, tras `if (this.galleryEl) this.galleryEl.photos = photos;`, añadir `applyPhotoCaptureLimit(this.photoCaptureEl, photos.length);`. En `handleDeletePhoto()`, tras filtrar `this.galleryEl.photos`, añadir la misma llamada con el nuevo `.length`.
  - `MODIFICAR src/cockpit/cockpit.element.spec.ts`.
- **Notas**:
  - Import nuevo: `applyPhotoCaptureLimit` desde `../shared/photo-capture/photo-capture.limit.js`.
  - `this.photoCaptureEl` es `null` cuando `!isActive` (fuera de grabación) — `applyPhotoCaptureLimit(null, ...)` ya es un no-op seguro (test del Paso 9), así que no hace falta ninguna comprobación adicional en las llamadas nuevas.

---

## Paso 12: Cypress — flujo cockpit (grabación completa) [x]

- **Objetivo**: Ampliar `cockpit.cy.ts` (ya reparado en el Paso 1) con el resto del flujo de grabación: pausa/reanudar, long-press de parada, guardar y descartar.
- **AC cubiertos**: AC-013 a AC-018.
- **Tests a escribir** (Cypress, TDD entendido aquí como "el test define el comportamiento esperado del flujo ya implementado" — no hay código de producción nuevo en este paso salvo lo ya cubierto en Pasos 1-11):
  - Estado inicial: `aria-label="Iniciar grabación"` y velocidad `0` → Valida AC-013 (ya existente tras el Paso 1, se deja como está).
  - Pulsar `cockpit-master-btn` en reposo → `aria-label="Mantén pulsado para finalizar la ruta"` y `cockpit-pause-btn` habilitado con `aria-label="Pausar ruta"` → Valida AC-014.
  - Con grabación activa, pulsar `cockpit-pause-btn` → `aria-label="Reanudar ruta"`; pulsar de nuevo → vuelve a `"Pausar ruta"` → Valida AC-015.
  - Mantener `pointerdown` sobre `cockpit-master-btn` 1500 ms reales (`cy.get(...).trigger('pointerdown'); cy.wait(1600); cy.get(...).trigger('pointerup');` — sin `cy.clock()`, la spec exige tiempo real) → aparece `cockpit-save-route-dialog` con `save-route-dialog-input-name` visible → Valida AC-016.
  - Escribir un nombre y pulsar `save-route-dialog-action-save` → el diálogo se cierra, toast "Ruta guardada", `cockpit-master-btn` vuelve a `"Iniciar grabación"` → Valida AC-017.
  - Repetir el long-press y pulsar `save-route-dialog-action-discard` → toast "Ruta descartada", ninguna ruta nueva visible en `route-list` (navegar a "Rutas" tras esto y comprobar), `cockpit-master-btn` vuelve a `"Iniciar grabación"` → Valida AC-018.
- **Archivos a crear/modificar**:
  - `MODIFICAR cypress/e2e/cockpit/cockpit.cy.ts`.
- **Notas**:
  - No hace falta seed de rutas para este flujo — arranca en reposo (repositorio vacío es el estado por defecto, ya lo garantiza `cy.visit('/')` normal si no se llama a `cy.visitWithSeed()`).
  - El long-press exige tiempo real de reloj (constraint explícito de la spec, `LONG_PRESS_MS = 1500`) — usar `cy.wait()` con margen (p. ej. 1700 ms) en vez de intentar acelerar el temporizador, ya que no hay timers falseables desde Cypress sobre el propio navegador.
  - Tras el AC-018 (descartar), la comprobación "no aparece ninguna ruta nueva" requiere navegar a `[data-cy="nav-rutas"]` y comprobar `[data-cy="route-list-empty"]` (o el recuento exacto de `route-card` si ya había rutas sembradas antes — en este spec concreto, cero).
  - **Gap de infraestructura detectado y corregido**: `cypress.config.ts` no tenía `includeShadowDom: true`. Toda la app usa Shadow DOM (`BaseElement.attachShadow`), así que sin esa opción `cy.get('[data-cy="..."]')` nunca encontraba nada — ni siquiera los 3 tests ya existentes del Paso 1, que fallaban en ejecución real (`Expected to find element: [data-cy="cockpit-master-btn"], but never found it`) aunque el DOM se veía correcto en el screenshot. Añadida la opción a `cypress.config.ts`; tras el cambio los 3 tests originales y los 5 nuevos de este paso pasan en verde.

---

## Paso 13: Cypress — flujo route-list [x]

- **Objetivo**: Verificar listado con N rutas sembradas, estado vacío, y el flujo de eliminar con confirmar/cancelar.
- **AC cubiertos**: AC-019 a AC-022.
- **Tests a escribir**:
  - `cy.visitWithSeed({ routes: [3 rutas con nombres únicos] })` + navegar a "Rutas" → exactamente 3 `[data-cy="route-card"]`, cada uno mostrando nombre y fecha correctos (`cy.contains('[data-cy="route-card"]', nombreÚnico)`) → Valida AC-019.
  - `cy.visit('/')` sin seed + navegar a "Rutas" → `[data-cy="route-list-empty"]` con texto "No hay rutas guardadas todavía", cero `route-card` → Valida AC-020.
  - Sembrar 1 ruta, pulsar `route-card-btn-eliminar` de su tarjeta, confirmar en `confirm-dialog-action-confirm` → la tarjeta desaparece, toast "Ruta eliminada" → Valida AC-021.
  - Sembrar 1 ruta, pulsar `route-card-btn-eliminar`, cancelar en `confirm-dialog-action-cancel` → la tarjeta sigue presente sin cambios → Valida AC-022.
- **Archivos a crear/modificar**:
  - `CREAR cypress/e2e/route-list/route-list.cy.ts`.
- **Notas**:
  - Usar nombres de ruta únicos con timestamp (`Ruta test ${Date.now()}`) para no colisionar entre ejecuciones paralelas — mismo criterio que el resto de specs de referencia (`docs/07-cypress-e2e.md`).
  - Este spec es, de facto, la verificación end-to-end de AC-008/AC-009 (Paso 7): si las rutas sembradas no aparecieran, o si aparecieran de más, este spec fallaría primero.

---

## Paso 14: Cypress — flujo route-detail [x]

- **Objetivo**: Navegación desde una tarjeta al detalle, cambio de pestañas sin recarga, y el flujo completo de notas (creación y edición).
- **AC cubiertos**: AC-023 a AC-028.
- **Tests a escribir**:
  - Sembrar 1 ruta con puntos GPS, pulsar su `route-card` → se navega al detalle: título con el nombre, `[data-cy="route-map-container"]` visible → Valida AC-023.
  - Pulsar cada botón de `<tab-bar>` (`tab-bar-btn-fotos`, `-estadisticas`, `-notas`, `-timeline`) → cada panel correspondiente se muestra; no vuelve a aparecer `[data-cy="route-detail-loading"]` al cambiar de pestaña (proxy de "no hay una nueva petición al repositorio", ya que espiar llamadas internas al repositorio no es observable desde Cypress sin instrumentación adicional; la garantía real de "no rebuild" está cubierta por el contrato de `<tab-bar>` y por `route-detail.element.spec.ts`, ver Notas) → Valida AC-024.
  - Sembrar una ruta con `notes: null`, ir a "Notas" → aparece directamente `[data-cy="route-detail-textarea-notas"]` (modo edición) → Valida AC-025.
  - Escribir texto y pulsar `route-detail-btn-guardar-nota` → toast "Nota guardada", pasa a modo lectura mostrando `[data-cy="route-detail-texto-nota"]` con el texto → Valida AC-026.
  - Sembrar una ruta con `notes` no vacío, ir a "Notas" → aparece directamente el modo vista (`route-detail-texto-nota` + `route-detail-btn-editar-nota`) → Valida AC-027.
  - Pulsar `route-detail-btn-editar-nota` → aparece `route-detail-textarea-notas` con el texto actual precargado → Valida AC-028.
- **Archivos a crear/modificar**:
  - `CREAR cypress/e2e/route-detail/route-detail.cy.ts`.
- **Notas**:
  - **Gap señalado (no bloqueante)**: la parte de AC-024 "sin una nueva petición al repositorio al cambiar de pestaña" no es observable de forma fiable desde Cypress sin instrumentar el repositorio (no hay ningún indicador en el DOM que distinga "recargó datos" de "no recargó"). Se recomienda dejar esa garantía específica cubierta por el test ya existente en `route-detail.element.spec.ts` (que si falla, ya lo haría contra un mock de repositorio espiado) y que este spec Cypress valide solo el efecto observable (el panel correcto se muestra, sin parpadeo de estado de carga). Si el usuario quiere una prueba E2E más estricta de "cero peticiones nuevas", haría falta añadir un contador visible en el DOM solo en modo test — cambio de spec, no de plan.
  - Sembrar `points` con al menos 2 puntos con `lat`/`lng` distintos para que `route-map-container` tenga contenido real que comprobar (constraint de la spec: no se verifica el tile renderizado, solo el contenedor).
  - **Gap de `data-cy` detectado y corregido (AC-023)**: el `<h1 class="detail-title">` de `route-detail.element.ts` no tenía `data-cy` propio. Como el nombre de la ruta sembrada también aparece (oculto, `display: none`) en la tarjeta correspondiente de `<route-list>` — montada en paralelo en el DOM ligero de `app-root`, nunca desmontada al navegar — un `cy.contains(nombre)` sin ámbito habría podido casar con el nodo equivocado. Añadido `data-cy="route-detail-title"` al título (TDD: test RED en `route-detail.element.spec.ts` confirmado antes del cambio, GREEN después). 567/567 Vitest, 18/18 Cypress (12 previos + 6 nuevos de este paso) en verde.

---

## Paso 15: Cypress — flujo fotos + verificación E2E del límite de 100 [x]

- **Objetivo**: Placeholder sin fotos, añadir desde cámara/galería, abrir/cerrar el visor, marcador en el mapa, y los 4 escenarios de comportamiento del límite de 100 fotos (ya implementado en los Pasos 9-11) verificados de extremo a extremo en el navegador real.
- **AC cubiertos**: AC-029 a AC-034, AC-041 a AC-045 (verificación E2E, complementaria a los tests unitarios de los Pasos 9-11).
- **Tests a escribir**:
  - Sembrar 1 ruta sin fotos, ir a "Fotos" → `[data-cy="photo-placeholder"]` con "Sin fotos", cero `photo-thumbnail` → Valida AC-029.
  - Pulsar `photo-add-button` → `photo-menu-camera`, `cy.get('[data-cy="photo-capture-input-file"]').selectFile('cypress/fixtures/<imagen>.jpg', { force: true })` → aparece una nueva `photo-thumbnail` → Valida AC-030 (usa el `data-cy` del Paso 4).
  - Pulsar `photo-add-button` → `photo-menu-gallery`, seleccionar 3 archivos a la vez (`selectFile([...], { force: true })`) → aparecen 3 `photo-thumbnail` nuevas → Valida AC-031.
  - Pulsar una `photo-thumbnail` → se abre el visor a pantalla completa con esa imagen → Valida AC-032.
  - Pulsar `photo-viewer-close` → el visor se cierra, vuelve a la galería en cuadrícula → Valida AC-033.
  - Sembrar una ruta con puntos GPS y, vía `moto-routes-photos`, una foto con `latitude`/`longitude` propios → el mapa del detalle muestra al menos `[data-cy="photo-marker"]` o `[data-cy="photo-cluster"]` → Valida AC-034.
  - Sembrar una ruta con exactamente 100 fotos (vía `moto-routes-photos`, sin subirlas una a una) → al abrir "Fotos", `photo-add-button` tiene `disabled` y `aria-label`/`title` distinto de "Añadir foto" → Valida AC-041, AC-042.
  - Sembrar una ruta con 99 fotos → `photo-add-button` no tiene `disabled` → Valida AC-043.
  - Sembrar 99 fotos, añadir 1 más vía "Galería" → el botón queda deshabilitado inmediatamente, sin recargar → Valida AC-044.
  - Sembrar 100 fotos (botón deshabilitado), borrar una desde la galería (miniatura → visor → `photo-viewer-delete` → confirmar) → el botón se rehabilita sin recargar → Valida AC-045.
- **Archivos a crear/modificar**:
  - `CREAR cypress/e2e/fotos/fotos.cy.ts`.
  - `CREAR cypress/fixtures/photo-sample.jpg` (o 3 ficheros distintos si se prefiere variar nombres) — imagen de prueba mínima para `selectFile()`.
- **Notas**:
  - Las 100/99 fotos sembradas por `moto-routes-photos` no necesitan ser imágenes reales — `filePath` puede ser un string simple tipo `photos/seed-${i}.jpg` (recordar que `getPhotoUrl()` ya trata cualquier `filePath` que empiece por `photos/` como "placeholder", devolviéndolo tal cual sin intentar leer del sistema de archivos — ver `photo-storage.service.ts`); lo único que importa para estos escenarios es el **conteo**, no el contenido visual de cada miniatura.
  - Generar el array de 100/99 fotos con un bucle simple en el propio `it()` (`Array.from({ length: 100 }, (_, i) => ({ id: crypto.randomUUID(), routeId, filePath: \`photos/seed-${i}.jpg\`, latitude: null, longitude: null, capturedAt: new Date(Date.now() - i * 1000).toISOString(), createdAt: new Date().toISOString() }))`) — no hace falta un fixture JSON dedicado para esto.
  - Usar `{ force: true }` en todos los `selectFile()` sobre `photo-capture-input-file` (Paso 4, input oculto pero funcional).
  - **Verificado en ejecución real**: los `data-cy` citados en la spec/plan (`photo-placeholder`, `photo-add-button`, `photo-menu-camera`, `photo-menu-gallery`, `photo-thumbnail`, `photo-viewer-close`, `photo-marker`/`photo-cluster`, `photo-viewer-delete`, `confirm-dialog-action-confirm`) ya existían tal cual en el código real (`photo-gallery.element.ts`, `photo-capture.element.ts`, `photo-viewer.element.ts`, `route-map-photos.ts`) — no hizo falta ningún cambio de producción ni de `data-cy` para este paso, a diferencia de los Pasos 12/14. Único gap encontrado: de test, no de código — encadenar `.should('have.attr', 'disabled').and(...)` en Cypress cambia el subject al valor del atributo (chai-jquery), rompiendo el `.and()` siguiente con "invalid subject"; corregido usando `.should('be.disabled')`/`.should('not.be.disabled')` (verifica el `disabled` nativo del `<button>` vía pseudo-clase `:disabled`, manteniendo el elemento como subject para poder encadenar `.and('have.attr', 'aria-label', ...)`). `cypress/fixtures/photo-sample.jpg` se generó como un JPEG mínimo válido (287 bytes) porque no había ninguna imagen de prueba ya existente en el repo. Ejecutado `pnpm run test:e2e` completo (las 4 specs, no solo `fotos.cy.ts`): **27/27 Cypress en verde** (8 cockpit + 9 fotos + 6 route-detail + 4 route-list); **567/567 Vitest** sin regresiones; `tsc --noEmit` limpio.

---

## Paso 16: Cypress — flujo timeline [x]

- **Objetivo**: Verificar los eventos de Salida/Llegada y el estado vacío de la pestaña Timeline con datos sembrados.
- **AC cubiertos**: AC-035 a AC-037.
- **Tests a escribir**:
  - Sembrar una ruta con puntos GPS suficientes y sin ninguna parada detectable (velocidad siempre por encima del umbral de `detectStop`), ir a "Timeline" → aparecen, en orden, `route-detail-timeline-evento-salida` seguido de `route-detail-timeline-evento-llegada` → Valida AC-035.
  - Sembrar la misma ruta añadiendo, vía `moto-routes-photos`, una foto con `capturedAt` dentro del rango temporal de la ruta → aparece `route-detail-timeline-evento-foto-{id}` en la posición cronológica correspondiente → Valida AC-036.
  - Sembrar una ruta sin puntos GPS y sin fotos, ir a "Timeline" → aparece `route-detail-timeline-vacio` → Valida AC-037.
- **Archivos a crear/modificar**:
  - `CREAR cypress/e2e/route-detail/timeline.cy.ts`.
- **Notas**:
  - Puede reutilizar `cypress/fixtures/gps-data.json` (ya existente, hoy huérfano) como base de puntos GPS para el escenario de AC-035/AC-036, adaptando timestamps si hace falta que la foto sembrada caiga dentro del rango — o generar los puntos inline si el fixture no encaja exactamente con el rango de tiempo necesario para la foto.
  - "Puntos GPS suficientes y sin ninguna parada detectable" implica que ningún tramo de ≥30 puntos consecutivos baje de ~3 km/h (criterio de `detectStop()`, ya usado por `timeline-ruta`) — generar velocidades siempre por encima de ese umbral en los puntos sembrados.
  - **Verificado en ejecución real**: los `data-cy` citados en la spec/plan (`route-detail-timeline-evento-salida`, `-evento-llegada`, `-evento-foto-{id}` con `{id}` siendo el `id` real de la foto sembrada, `-vacio`) ya existían tal cual en `route-detail-timeline.ts` (dominio `timeline-ruta`, sin cambios de código de producción). Puntos generados inline (2 puntos, velocidad 40/45 km/h, ambos muy por encima de los 3 km/h de `detectStop()`) en vez de reutilizar `cypress/fixtures/gps-data.json` — más simple y controla con precisión el rango temporal necesario para que la foto de AC-036 caiga dentro (`capturedAt` a mitad del intervalo `[salida, llegada]`). El orden cronológico Salida→Foto→Llegada se verifica con `compareDocumentPosition()` (sin selectores de clase/ID/posición, solo aserción de orden real en el DOM sobre nodos ya localizados por `data-cy`). Ejecutado `pnpm run test:e2e` completo (las 5 specs): **30/30 Cypress en verde** (8 cockpit + 9 fotos + 6 route-detail + 3 timeline + 4 route-list); **567/567 Vitest** sin regresiones.

---

## Puntos abiertos para el usuario (no bloquean el plan, conviene confirmarlos antes o durante los Pasos 8/14)

- **AC-012 y el diseño de `cy.visitWithSeed()`** (Paso 8): la spec pide que la siembra de fotos quede "documentada, sin mecanismo nuevo" — este plan interpreta eso como "un único comando Cypress reutilizable que centraliza el `localStorage.setItem` ya usado hoy para rutas y fotos, más una sección de documentación en `docs/07-cypress-e2e.md`". Si el usuario prefiere que cada spec escriba su propio `localStorage.setItem` inline sin ningún comando compartido (aún más literal con "sin mecanismo nuevo"), el cambio es menor: eliminar `cypress/support/commands.ts` y repetir el patrón `cy.visit('/', { onBeforeLoad(win) {...} })` en cada spec de los Pasos 12-16 — no afecta al resto del plan.
- **AC-024 ("sin recargar los datos de la ruta" al cambiar de pestaña)**: como se señala en el Paso 14, la parte "no hay una nueva petición al repositorio" no es verificable de forma estricta desde Cypress sin instrumentación adicional en el DOM. Se resuelve apoyándose en la garantía ya existente a nivel de unidad (`<tab-bar>`/`route-detail.element.spec.ts`) más la verificación visual E2E del efecto observable. Si el usuario necesita una prueba E2E más estricta, requeriría un cambio de spec (p. ej. exponer un contador de peticiones solo en modo test), no solo de plan.
- Ninguna otra ambigüedad detectada: los 45 AC quedan cubiertos por los Pasos 1-16, y las decisiones de ubicación dejadas abiertas por la spec (`MAX_PHOTOS_PER_ROUTE`, la propiedad `limitReached`, el método `seed()`, el nombre de la clave `cypress-seed-routes`) quedan resueltas explícitamente en los Pasos 6, 7 y 9 con su justificación.
