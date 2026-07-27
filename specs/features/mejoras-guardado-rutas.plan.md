# Plan de Implementación: Mejoras de Guardado y Gestión de Rutas

## Decisiones de diseño resueltas en este plan

La spec dejó explícitamente a criterio del plan-agent dónde vive el campo de nombre (AC-001 a AC-009). Antes de descomponer en tareas, se fijan las siguientes decisiones — todas dentro de los márgenes que la spec ya aprobó, ninguna añade AC nuevos:

1. **Campo de nombre → diálogo propio, no se amplía `<confirm-dialog>`.** Se crea `cockpit-save-route-dialog` en `src/cockpit/` (dominio de grabación, único consumidor) en vez de añadir un `input` embebido a `ConfirmDialogOptions`. Motivo: `<confirm-dialog>` es un componente compartido usado hoy por `route-list.element.ts`, `photo-delete.service.ts` y el propio flujo de parada, con contrato `Promise<string | null>` cubierto por 8+ tests (`confirm-dialog.element.spec.ts`) y marcado como "CRÍTICO en review" en `mejoras-usabilidad.md`. Cambiar su tipo de resolución para devolver también un valor de texto habría obligado a tocar los tres consumidores y su suite de tests por un caso de uso que solo necesita uno de ellos. El nuevo diálogo reutiliza el mismo lenguaje visual (clases `.dialog`/`.actions`/`.action*`, tokens de `tokens.css`) y replica el patrón de foco (`trapFocus`, `closable: false` fijo — parar una ruta obliga a decidir, igual que hoy) de `confirm-dialog.element.ts`, aceptando la duplicación de ese fragmento de lógica como compromiso documentado.
   - **Acción recomendada al implementar este paso**: registrar esta decisión como ADR nuevo en `memory/decisions.md` (siguiente número disponible tras ADR-024), con esta misma justificación — es una decisión de arquitectura de UI compartida, no un detalle de implementación menor.
2. **`name` viaja en el mismo `CreateRoute`/`save()` que el resto de campos** (duration, totalDistance, status…), no como un método independiente al estilo `updatePreviewPolyline`. Motivo: a diferencia de `previewPolyline` (recalculable en cualquier momento) o `notes` (se edita después, desde `route-detail`, en un momento totalmente distinto), `name` se decide en el mismo instante que ya dispara el `save()` final de `confirmSaveRecording()` — no hay razón para partirlo en una llamada aparte.
3. **`CreateRoute.name` es opcional** (`name?: string`), no obligatorio. El **constraint** de la spec ("guardar siempre persiste un nombre no vacío") se garantiza en la capa de orquestación (`cockpit-stop.service.ts`, que siempre calcula un nombre — propio o por defecto — antes de llamar a `confirmSaveRecording(name)`), no en el tipo `CreateRoute`. Esto evita que decenas de literales `CreateRoute` ya existentes en tests no relacionados con esta feature (`route-deletion.service.spec.ts`, fixtures de `route-list`/`route-detail`, etc.) dejen de compilar por un campo obligatorio que no les concierne. La fila `'active'` que se inserta al empezar a grabar (antes de que exista ningún nombre) simplemente no lo incluye — queda `NULL` hasta que `confirmSaveRecording` la actualiza, y mientras tanto cae en el mismo fallback "Ruta {fecha}" que ya cubre AC-007.
4. **`notes` sigue el patrón `updatePreviewPolyline`**: método independiente `IRouteRepository.updateNotes(routeId, notes: string | null)`, nunca pasa por `CreateRoute`/`save()`.
5. **Fecha/hora por defecto (AC-002) usa `metadata.date`** (ya presente en `RouteMetadata`, capturado en `prepareStop()` — es decir, el momento en que el usuario para la ruta), no el `createdAt` de inicio de grabación. Evita tener que propagar un dato nuevo hasta `resolveStopDecision`, que ya recibe `metadata` completo.

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Modelo de dominio + contrato de repositorio (`name`/`notes`) | `route.types.ts`, `route.repository.ts`, `route.repository.spec.ts` | AC-004, AC-015 | Small |
| 2 | `MemoryRouteRepository`: soporte de `name`/`notes` | `memory-route.repository.ts` | AC-004, AC-015, AC-016 | Small |
| 3 | `SqliteRouteRepository`: migración `ALTER TABLE` + soporte de `name`/`notes` | `sqlite-route.repository.ts`, `sqlite-route.repository.spec.ts` | AC-004, AC-007, AC-015, AC-016 | Medium |
| 4 | Formato de nombre por defecto y saneado (`cockpit.transform.ts`) | `cockpit.transform.ts`, `cockpit.transform.spec.ts` | AC-002, AC-003, AC-009 | Small |
| 5 | Diálogo `cockpit-save-route-dialog` | `cockpit-save-route-dialog.element.ts`, `.css`, `.spec.ts` | AC-001, AC-003, AC-008, AC-009 | Medium |
| 6 | `CockpitService.confirmSaveRecording(name)` + persistencia | `cockpit.service.ts`, `cockpit-persist.service.ts`, `cockpit.service.spec.ts` | AC-002, AC-003, AC-004 | Small |
| 7 | `cockpit-stop.service.ts`: wiring del nuevo diálogo | `cockpit-stop.service.ts`, `cockpit-stop.service.spec.ts` | AC-001, AC-002, AC-003, AC-008, AC-009 | Medium |
| 8 | Actualizar tests de `cockpit.element.spec.ts` al nuevo diálogo | `cockpit.element.spec.ts` | AC-001 (regresión) | Small |
| 9 | Mostrar `route.name` en listado y detalle, con fallback | `route-list.element.ts`, `route-list.element.spec.ts`, `route-detail.element.ts`, `route-detail.element.spec.ts` | AC-005, AC-006, AC-007 | Medium |
| 10 | Editor de notas en `route-detail` | `route-detail.element.ts`, `route-detail.element.css`, `route-detail.element.spec.ts` | AC-010 a AC-017 | Medium |
| 11 | Fix visual del punto en `nav-item--record` | `nav-bar.element.css`, `nav-bar.element.spec.ts` | AC-018 | Small |

Orden de dependencias: 1 → 2 → 3 (persistencia primero). 4 y 5 son independientes entre sí y de 1-3, pero ambas deben estar listas antes de 7. 6 depende de 1-3 (necesita `Route.name`) y es independiente de 4/5. 7 depende de 4, 5 y 6. 8 depende de 7 (mismos data-cy). 9 depende de 1-3. 10 depende de 1-3. 11 no depende de nada — puede hacerse en cualquier momento del ciclo.

---

## Paso 1: Modelo de dominio + contrato de repositorio (`name`/`notes`) [x]

- **Objetivo**: Añadir `name`/`notes` a las entidades de dominio y al contrato `IRouteRepository`, con tests de contrato que fallen contra cualquier implementación hasta que los pasos 2 y 3 los satisfagan.
- **AC cubiertos**: AC-004 (persistencia de `name`, a nivel de contrato), AC-015 (persistencia de `notes`, a nivel de contrato).
- **Tests a escribir** (en `route.repository.spec.ts`, dentro de `createRouteSuite`, ejecutados luego contra Memory y Sqlite):
  - Test: `save()` con `name` en el `CreateRoute` persiste y devuelve ese `name` tal cual → Valida AC-004.
  - Test: una ruta recién guardada sin `name` en el `CreateRoute` tiene `name: null` → prepara el fallback de AC-007 (verificado en el paso 9 a nivel de UI).
  - Test: una ruta recién guardada tiene `notes: null` por defecto → Valida AC-015 (parte "sin nota guardada").
  - Test: `updateNotes(id, 'texto')` persiste y `getById` lo devuelve → Valida AC-015.
  - Test: `updateNotes(id, null)` sobre una ruta con nota previa la deja en `null`, sin error → Valida AC-016 (a nivel de contrato; el trigger UI de "guardar vacío" se cubre en el paso 10).
  - Test: `updateNotes` sobre un id inexistente no lanza (comportamiento no-op, mismo criterio que `updatePreviewPolyline`).
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/models/route.types.ts`: `Route` gana `name: string | null` y `notes: string | null`; `CreateRoute` gana `name?: string` (opcional — ver decisión de diseño #3).
  - `MODIFICAR src/shared/models/route.repository.ts`: añadir `updateNotes(routeId: string, notes: string | null): Promise<void>` a `IRouteRepository`, documentado igual que `updatePreviewPolyline`.
  - `MODIFICAR src/shared/models/route.repository.spec.ts`: nueva función `registerNameAndNotesTests(getRepo)` con los tests de arriba, registrada en `createRouteSuite` junto a `registerPreviewPolylineTests`.
- **Notas**: Este paso solo toca contrato + tests — no compila todavía (`MemoryRouteRepository`/`SqliteRouteRepository` no implementan aún `updateNotes`). Es intencional en TDD: los pasos 2 y 3 lo hacen pasar. No tocar `sampleRoute` (el fixture base ya existente) — los tests nuevos usan sus propios literales `{ ...sampleRoute, name: '...' }` para no afectar a los tests preexistentes que no conocen `name`/`notes`.

## Paso 2: `MemoryRouteRepository` — soporte de `name`/`notes` [x]

- **Objetivo**: Hacer pasar la suite de contrato del paso 1 contra la implementación en memoria (la más simple), confirmando que el diseño del contrato es implementable antes de abordar SQLite.
- **AC cubiertos**: AC-004, AC-015, AC-016 (contra `MemoryRouteRepository`, usada en dev web y en gran parte de los tests de UI de los pasos siguientes).
- **Tests a escribir**: ninguno nuevo — los del paso 1 (`createRouteSuite('MemoryRouteRepository', …)`) deben pasar en verde al terminar este paso.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/repositories/memory-route.repository.ts`:
    - `save()`: `savedRoute.name = route.name ?? existing?.name ?? null` (coalescer con el valor existente, igual que ya hace `previewPolyline`, para no perder el nombre en el segundo `save()` de la ruta activa→completada). `savedRoute.notes` se preserva igual (`existing?.notes ?? null`) — nunca se toca desde `save()`.
    - Nuevo método `updateNotes(routeId, notes)`: si la ruta existe, `this.routes.set(routeId, { ...existing, notes })`; si no existe, no-op (mismo patrón que `updatePreviewPolyline`).
- **Notas**: Sin cambios de tipo en la firma pública más allá de lo ya definido en el paso 1.

## Paso 3: `SqliteRouteRepository` — migración `ALTER TABLE` + soporte de `name`/`notes` [x]

- **Objetivo**: Migrar instalaciones existentes añadiendo las columnas `name` y `notes` bajo demanda (mismo patrón que `preview_polyline`, ADR-020), y hacer pasar la suite de contrato + los tests de migración específicos.
- **AC cubiertos**: AC-004, AC-007 (la migración no debe romper filas existentes ni dejar hueco visual), AC-015, AC-016.
- **Tests a escribir** (en `sqlite-route.repository.spec.ts`):
  - Test: con una tabla `routes` preexistente sin columna `name` ni `notes`, `getAll()`/`getById()` ejecuta `ALTER TABLE routes ADD COLUMN name TEXT;` y `ALTER TABLE routes ADD COLUMN notes TEXT;` exactamente una vez cada una, y la fila preexistente se devuelve con `name: null`, `notes: null`, sin error → Valida AC-004, AC-007, AC-015 (regresión, mismo test que ya existe para `preview_polyline`, extendido).
  - Test: si las columnas ya existen, no se ejecuta ningún `ALTER TABLE` adicional.
  - Test (vía `createRouteSuite('SqliteRouteRepository (mock DB)', …)`, heredado del paso 1): `save()`/`updateNotes()` funcionan igual que en memoria, contra el mock de `SqlDb`.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/repositories/sqlite-route.repository.ts`:
    - `ensureSchema()`: añadir llamadas a `ensureNameColumn()` y `ensureNotesColumn()` (mismo patrón que `ensurePreviewPolylineColumn()`, comprobando `PRAGMA table_info(routes)` antes de cada `ALTER TABLE`).
    - `save()`: el `INSERT` gana la columna `name` (`route.name ?? null`); el `UPDATE` gana `name = ?` con el valor coalescido (`route.name ?? existing?.name ?? null`) para no perder el nombre si una llamada futura omitiera el campo.
    - `rowToRoute()`: mapear `name: r.name ?? null` y `notes: r.notes ?? null`.
    - `RouteRow`: añadir `name?: string | null; notes?: string | null;`.
    - Nuevo método `updateNotes(routeId, notes)`: `UPDATE routes SET notes = ? WHERE id = ?`.
  - `MODIFICAR src/shared/repositories/sqlite-route.repository.spec.ts`:
    - Extender `createMigrationMockDb()` con flags `hasNameColumn`/`hasNotesColumn` (por defecto `false` en los tests de migración nuevos), añadiendo `{ name: 'name' }`/`{ name: 'notes' }` a `columnInfo` cuando corresponda — igual que ya hace con `preview_polyline`.
    - **Cuidado especial**: `insertRoute()`/`updateRoute()` (los helpers genéricos del mock, usados por TODA la suite de contrato vía `createRouteSuite`, no solo por los tests nuevos) deben actualizarse para incluir `name` en la lista de parámetros posicionales del `INSERT`/`UPDATE`, en el mismo orden en que `sqlite-route.repository.ts` los pase — un desajuste de orden rompe silenciosamente el resto de tests de la suite, no solo los de `name`. Añadir también una rama en `queryMock()` para `UPDATE ROUTES SET NOTES` (mismo patrón que la rama ya existente para `UPDATE ROUTES SET PREVIEW_POLYLINE`).
- **Notas**: Verificación real en dispositivo Android (migración sobre una BBDD con datos reales) queda fuera del alcance de este paso — es un pendiente de verificación manual, igual que ISSUE-001 de `mejoras-fotos-mapa.review.md` para `preview_polyline`.

## Paso 4: Formato de nombre por defecto y saneado (`cockpit.transform.ts`) [x]

- **Objetivo**: Funciones puras para el nombre por defecto (AC-002) y el saneado del nombre introducido por el usuario (AC-003, AC-009), reutilizables tanto por el diálogo como por `cockpit-stop.service.ts`.
- **AC cubiertos**: AC-002, AC-003, AC-009.
- **Tests a escribir** (en `cockpit.transform.spec.ts`):
  - Test: `sanitizeRouteName('  Puerto de la Bonaigua  ')` devuelve `'Puerto de la Bonaigua'` (recorta espacios de los extremos) → Valida AC-003.
  - Test: `sanitizeRouteName('   ')` (solo espacios) devuelve `''` → prepara el fallback de AC-002.
  - Test: `sanitizeRouteName('a'.repeat(150))` devuelve una cadena de exactamente 100 caracteres → Valida AC-009.
  - Test: `buildDefaultRouteName('2026-07-27T12:30:00.000Z')` devuelve una cadena que empieza por `'Ruta '` y contiene día, mes abreviado, año y hora `HH:mm` separada por coma (comparar con una regex tolerante a zona horaria del entorno de test, no con un literal exacto, para no acoplar el test a la TZ de CI) → Valida AC-002.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.transform.ts`: añadir `sanitizeRouteName(raw: string): string` (trim + `slice(0, 100)`) y `buildDefaultRouteName(dateIso: string): string` (usa `toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })` + `toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })`, tal como especifica la sección "Notas de Implementación" de la spec).
  - `MODIFICAR src/cockpit/cockpit.transform.spec.ts`: tests de arriba.
- **Notas**: Ninguna de las dos funciones toca DOM ni servicios — son las candidatas naturales para ser reutilizadas también, en el futuro, si se añadiera un "renombrar ruta" (fuera de alcance de esta spec).

## Paso 5: Diálogo `cockpit-save-route-dialog` [x]

- **Objetivo**: Nuevo Web Component específico del dominio `cockpit` que reemplaza al `confirmDialog()` genérico en el flujo de parada, añadiendo el campo de nombre (decisión de diseño #1).
- **AC cubiertos**: AC-001 (campo de texto editable antes de elegir), AC-003 (texto tal cual escrito, ver Paso 4 para el saneado real), AC-008 (el nombre no se filtra si se descarta — se garantiza en el llamador, Paso 7, no aquí), AC-009 (límite de 100 caracteres a nivel de input).
- **Tests a escribir** (`cockpit-save-route-dialog.element.spec.ts`):
  - Test: `openSaveRouteDialog({ message })` monta `<cockpit-save-route-dialog>` en `document.body`, con el input de nombre vacío y foco inicial en él → Valida AC-001.
  - Test: escribir texto en el input y pulsar la acción "save" resuelve `{ action: 'save', name: '<texto tal cual, sin trim>' }` → Valida AC-001, AC-003 (el trim/saneado final es responsabilidad del llamador, Paso 4/7 — este componente es solo de presentación).
  - Test: pulsar "save" sin escribir nada resuelve `{ action: 'save', name: '' }`.
  - Test: pulsar la acción "discard" resuelve `{ action: 'discard', name: '<lo que hubiera escrito>' }` — el propio componente no descarta el valor, es el llamador quien decide ignorarlo (AC-008 se verifica de extremo a extremo en el Paso 7).
  - Test: el input tiene el atributo `maxlength="100"` → Valida AC-009 (límite aplicado por el navegador al escribir).
  - Test: `Escape` y click en el overlay no cierran el diálogo (siempre `closable: false`, igual que el flujo actual) → regresión de AC-006 de `mejoras-usabilidad`.
  - Test: `Tab`/`Shift+Tab` ciclan el foco entre el input y los dos botones sin escapar del diálogo.
- **Archivos a crear/modificar**:
  - `CREAR src/cockpit/cockpit-save-route-dialog.element.ts`: clase `CockpitSaveRouteDialogElement extends BaseElement`, tag `<cockpit-save-route-dialog>`; función exportada `openSaveRouteDialog(options: { message: string }): Promise<{ action: 'save' | 'discard'; name: string }>` (API análoga a `confirmDialog()`, pero sin `title`/`actions` configurables — están fijados: título "¿Guardar la ruta?", acciones "Descartar"/"Guardar"). Replica de `confirm-dialog.element.ts`: `attachShadow`, `connectedCallback`/`disconnectedCallback` con listener de `keydown`, `trapFocus` (documentar en comentario que es una réplica deliberada, no una extracción — ver decisión de diseño #1).
  - `CREAR src/cockpit/cockpit-save-route-dialog.element.css`: mismas clases visuales que `confirm-dialog.element.css` (`.overlay`, `.dialog`, `.title`, `.message`, `.actions`, `.action`, `.action--primary`, `.action--danger`) más un bloque nuevo para el campo (`.field`, `.input`) usando tokens (`--panel-sunken`, `--line`, `--ink`, `var(--font-ui)`, `--hitbox-min` para la altura mínima del input).
  - `CREAR src/cockpit/cockpit-save-route-dialog.element.spec.ts`: tests de arriba.
  - data-cy: `save-route-dialog-input-name`, `save-route-dialog-action-save`, `save-route-dialog-action-discard`, `save-route-dialog-overlay` (mismo esquema de nombres que `confirm-dialog-*`, con el contexto cambiado).
- **Notas**: Si en una futura iteración aparece un tercer diálogo con patrón "confirmar + campo de texto", conviene revisar si extraer el focus-trap a un helper compartido (`src/shared/feedback/focus-trap.ts`) — no se hace ahora para no ampliar el alcance de esta spec (regla de frontend-conventions.md: promover a `shared/` solo cuando 2+ dominios lo necesiten; hoy solo lo usa `cockpit`).

## Paso 6: `CockpitService.confirmSaveRecording(name)` + persistencia [x]

- **Objetivo**: Propagar el nombre elegido hasta la fila `routes` que persiste `confirmSaveRecording()`.
- **AC cubiertos**: AC-002, AC-003, AC-004.
- **Tests a escribir/actualizar** (`cockpit.service.spec.ts`):
  - Actualizar los ~9 call-sites existentes de `service.confirmSaveRecording()` para pasar un nombre literal (p.ej. `'Ruta de prueba'`) — mecánico, sin cambio de comportamiento en esos tests.
  - Test nuevo: `confirmSaveRecording('Puerto de la Bonaigua')` persiste una ruta con `name: 'Puerto de la Bonaigua'` → Valida AC-004.
  - Test nuevo (regresión AC-007, verificado a nivel de datos): la fila `'active'` insertada por `startRecording()` (antes de llamar a `confirmSaveRecording`) tiene `name: null` — confirma que el paso 9 encontrará el caso de fallback también para rutas interrumpidas, no solo para rutas antiguas.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.service.ts`: `CockpitService.confirmSaveRecording(name: string): void` (cambia la firma de la interfaz); `confirmSaveRecordingAction(store, repository, name)` pasa `name` a `persistRouteOnStop`.
  - `MODIFICAR src/cockpit/cockpit-persist.service.ts`: `persistRouteOnStop(repository, state, name)` añade `name` a `buildCreateRoute()`. `buildActiveRoute()` (usada por `persistRouteOnStart`, llamada antes de que exista ningún nombre) **no** incluye `name` — queda `undefined`/`null` a propósito (ver decisión de diseño #3).
  - `MODIFICAR src/cockpit/cockpit.service.spec.ts`: actualizaciones + tests de arriba.
- **Notas**: `persistRouteOnStart`/`buildActiveRoute` no cambian su firma — solo `persistRouteOnStop`/`buildCreateRoute` ganan el parámetro `name`.

## Paso 7: `cockpit-stop.service.ts` — wiring del nuevo diálogo [x]

- **Objetivo**: Sustituir el `confirmDialog()` genérico por `openSaveRouteDialog()`, calcular el nombre final (propio saneado o por defecto) y pasarlo a `confirmSaveRecording`.
- **AC cubiertos**: AC-001, AC-002, AC-003, AC-008, AC-009 (de extremo a extremo, no solo a nivel de componente aislado).
- **Tests a escribir/actualizar** (`cockpit-stop.service.spec.ts`):
  - Actualizar los 3 tests existentes: donde antes se localizaba `confirm-dialog` y se hacía click en `[data-cy="confirm-dialog-action-save"]`/`[data-cy="confirm-dialog-action-discard"]`, ahora se localiza `cockpit-save-route-dialog` y se usan `[data-cy="save-route-dialog-action-save"]`/`[data-cy="save-route-dialog-action-discard"]`.
  - Test nuevo: escribir un nombre en el input antes de pulsar "save" → `service.confirmSaveRecording` se llama con ese nombre recortado → Valida AC-001, AC-003.
  - Test nuevo: pulsar "save" sin escribir nada → `service.confirmSaveRecording` se llama con un nombre que cumple el formato de `buildDefaultRouteName(metadata.date)` → Valida AC-002.
  - Test nuevo: escribir un nombre y pulsar "discard" → la ruta no se persiste y `service.confirmSaveRecording` nunca se llama (mismo aserto que ya existe para el flujo de descarte, pero verificando explícitamente que el nombre escrito no aparece en ningún sitio) → Valida AC-008.
  - Test nuevo: escribir un nombre de más de 100 caracteres y pulsar "save" → el nombre persistido queda recortado a 100 → Valida AC-009 (integración).
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit-stop.service.ts`: `decideStopOutcome()` se sustituye por una llamada a `openSaveRouteDialog({ message })`; en la rama `action === 'save'`, `const finalName = sanitizeRouteName(result.name) || buildDefaultRouteName(metadata.date); service.confirmSaveRecording(finalName);`. El resto del flujo de descarte no cambia.
  - `MODIFICAR src/cockpit/cockpit-stop.service.spec.ts`: actualizaciones + tests de arriba.
- **Notas**: `ResolveStopDecisionParams['service']` sigue siendo `Pick<CockpitService, 'confirmSaveRecording' | 'discardStop'>` — solo cambia la firma de `confirmSaveRecording` (ya reflejada en el paso 6), no la forma del `Pick`.

## Paso 8: Actualizar `cockpit.element.spec.ts` al nuevo diálogo [x]

- **Objetivo**: Los 4 tests de `cockpit.element.spec.ts` que interactúan directamente con `confirm-dialog` (guardar, descartar, ESC, click en overlay) deben apuntar al nuevo `cockpit-save-route-dialog`.
- **AC cubiertos**: AC-001 (regresión de extremo a extremo, incluyendo el long-press real del botón de parar).
- **Tests a escribir/actualizar**:
  - `getConfirmDialog()` (helper del spec) pasa a buscar `document.body.querySelector('cockpit-save-route-dialog')` en vez de `'confirm-dialog'` (renombrar a `getSaveRouteDialog()` para claridad).
  - Los 4 tests de la sección `'CockpitView - guardar/descartar al parar (AC-003 a AC-006)'` actualizan sus selectores `data-cy` (`confirm-dialog-action-save` → `save-route-dialog-action-save`, etc.), sin cambiar la lógica de aserción.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.spec.ts`.
- **Notas**: Ningún cambio en `cockpit.element.ts` — ya delega toda la decisión en `resolveStopDecision()` (paso 7), que es donde vive el nuevo diálogo.

## Paso 9: Mostrar `route.name` en listado y detalle, con fallback [x]

- **Objetivo**: `<route-list>` y `<route-detail>` muestran el nombre persistido; si es `null`/vacío (rutas antiguas o interrumpidas), mantienen exactamente el cálculo "Ruta {fecha}" que ya usan hoy.
- **AC cubiertos**: AC-005, AC-006, AC-007.
- **Tests a escribir**:
  - `route-list.element.spec.ts` — Test: una ruta con `name: 'Puerto de la Bonaigua'` muestra ese texto en `.name` de la tarjeta → Valida AC-005.
  - `route-list.element.spec.ts` — Test: una ruta con `name: null` sigue mostrando `'Ruta {fecha}'` (mismo formato que hoy, sin hueco vacío) → Valida AC-007.
  - `route-detail.element.spec.ts` — Test: una ruta con `name` muestra ese texto como `.detail-title` → Valida AC-006.
  - `route-detail.element.spec.ts` — Test: una ruta con `name: null` sigue mostrando el título derivado de `createdAt` que ya existe hoy → Valida AC-007.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-list.element.ts`: en `buildCard()`, `name.textContent = route.name?.trim() ? route.name : 'Ruta ' + <mismo cálculo de fecha ya existente>`.
  - `MODIFICAR src/routes/route-list.element.spec.ts`: tests de arriba.
  - `MODIFICAR src/routes/route-detail.element.ts`: en `buildHeader()`, mismo patrón de fallback sobre `title.textContent`.
  - `MODIFICAR src/routes/route-detail.element.spec.ts`: tests de arriba.
- **Notas**: No se unifica el formato de fecha entre listado (día/mes/año) y detalle (día/mes) — son históricamente distintos y la spec no pide unificarlos (ver Notas de Implementación de la spec y ADR-024 como precedente de "no tocar lo que no pide la spec"). El campo `.date`/`.detail-date` (la línea secundaria con la fecha) no cambia — sigue mostrando la fecha igual que hoy, tenga o no `name` la ruta.

## Paso 10: Editor de notas en `route-detail` [x]

- **Objetivo**: Sustituir `buildNotasPlaceholder()` por un área de texto editable con acción de guardado explícita, persistida vía `updateNotes()`.
- **AC cubiertos**: AC-010, AC-011, AC-012, AC-013, AC-014, AC-016, AC-017.
- **Tests a escribir** (`route-detail.element.spec.ts`):
  - **Eliminar/reemplazar** el test existente `'shows a static example placeholder text in "Notas" (AC-007)'` (línea ~384) — ese placeholder deja de existir; su AC pertenecía a una iteración anterior (`mejoras-fotos-mapa`) y queda superado por AC-010 de esta spec.
  - Test: al abrir el detalle de una ruta sin notas (`notes: null`), el área de texto está vacía y su `placeholder` es `'Escribe aquí tus notas sobre la ruta…'` → Valida AC-014.
  - Test: al abrir el detalle de una ruta con `notes: 'Buen firme, gasolinera en el km 40'`, el área de texto muestra ese contenido sin acción del usuario → Valida AC-013.
  - Test: escribir texto y pulsar "Guardar nota" llama a `repository.updateNotes(routeId, texto)` y muestra un toast `'Nota guardada'` (`data-cy="photo-toast"`, reutilizando `showToast`) → Valida AC-010, AC-011, AC-012.
  - Test: editar el texto de una nota ya existente y guardar actualiza el valor persistido (se verifica releyendo vía `repository.getById`) → Valida AC-013 (edición).
  - Test: borrar todo el contenido del área y pulsar "Guardar nota" llama a `updateNotes(routeId, null)` sin mostrar ningún diálogo de confirmación, y sí el toast de éxito → Valida AC-016.
  - Test: si `updateNotes` rechaza la promesa, se muestra un toast de error (`data-cy="photo-toast-error"`) y el `<textarea>` conserva el texto escrito (no se limpia ni se refetchea) → Valida AC-017.
  - Test (regresión): cambiar a la pestaña "Notas" y volver a "Fotos" no vuelve a pedir la ruta/fotos/puntos — ya cubierto por el test existente de la línea ~392, debe seguir en verde sin modificarlo.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-detail.element.ts`: renombrar `buildNotasPlaceholder()` a `buildNotasPanel(route: Route)`; construye un `<textarea data-cy="route-detail-textarea-notas">` (placeholder, valor inicial `route.notes ?? ''`) y un `<button data-cy="route-detail-btn-guardar-nota">Guardar nota</button>`; nuevo manejador `handleSaveNote()`: lee el valor del textarea, si el `trim()` es vacío llama a `this._repository.updateNotes(this._routeId, null)`, si no, `updateNotes(this._routeId, textarea.value)`; en éxito actualiza `this._route.notes` en memoria y `showToast('Nota guardada', 'success')`; en error, `showToast(`⚠️ ${toErrorMessage(err, 'Error al guardar la nota')}`, 'error')` sin tocar el contenido del textarea.
  - `MODIFICAR src/routes/route-detail.element.css`: mantener `.note-text` si sigue haciendo falta en otro sitio (revisar), añadir `.notes-textarea` (usando `var(--panel-sunken)`, `var(--line)`, `var(--font-ui)`, altura mínima `var(--hitbox-min)`) y `.notes-save-btn` (mismo lenguaje visual que otros botones de acción del detalle, p. ej. `.detail-photo-capture`).
  - `MODIFICAR src/routes/route-detail.element.spec.ts`: tests de arriba.
- **Notas**: No se exige confirmación de tipo destructivo al guardar vacío (constraint explícito de la spec, AC-016) — a diferencia de `deletePhotoWithConfirmation`/`handleDeleteRoute`, que sí usan `confirmDialog`. No se toca `rerenderPhotosSection()` ni el resto de pestañas.

## Paso 11: Fix visual del punto en `nav-item--record` [x]

- **Objetivo**: Centrar `.record-dot` respecto al círculo real (`::before`, 56×56px) en vez de calcularlo a ojo sobre la caja con padding del botón — causa raíz documentada en la spec: `top: 20px` no descuenta el `padding: 4px` heredado de `.nav-item`.
- **AC cubiertos**: AC-018.
- **Tests a escribir** (`nav-bar.element.spec.ts`):
  - Test guarda-regresión sobre el CSS fuente (import `?inline`, como ya hace el propio componente): `styles` ya no contiene la regla `top: 20px` fija para `.record-dot` acoplada al padding del botón — en su lugar, `.record-dot` y `.nav-item--record::before` comparten la misma celda de un `display: grid` (mismo `grid-row`/`grid-column`, o `grid-area`), técnica de centrado independiente del padding del contenedor. Este test es un guard de regresión sobre el enfoque, no una prueba visual real — jsdom no calcula layout/geometría.
  - Test (ya existente, no debería romperse): `nav-item--record` sigue teniendo `data-cy="nav-grabar"` y el mismo contenido (`.record-dot` + `.nav-label`) — confirma que el fix es solo CSS, sin tocar el DOM (constraint explícito de la spec).
- **Archivos a crear/modificar**:
  - `MODIFICAR src/components/nav-bar/nav-bar.element.css`: reestructurar `.nav-item--record` a `display: grid` (dos filas: círculo+punto apilados en la misma celda, etiqueta debajo), `.nav-item--record::before` y `.nav-item--record .record-dot` compartiendo `grid-row`/`grid-column` (o `grid-area`) con `justify-self: center; align-self: center` en el punto — así el centrado no depende de ningún cálculo numérico de padding, es estructural.
  - `MODIFICAR src/components/nav-bar/nav-bar.element.spec.ts`: test guard de arriba.
- **Notas**: **Verificación final recomendada fuera de este paso**: captura visual (Cypress screenshot o build Android real) para confirmar el centrado perceptual, siguiendo el mismo criterio ya aplicado en ADR-022 ("verificado visualmente... no solo con tests unitarios") — jsdom no puede confirmarlo por sí solo. No requiere `pnpm tauri android build` completo; basta una comprobación visual en `pnpm run dev` (web) dado que es CSS puro sin dependencias nativas.
