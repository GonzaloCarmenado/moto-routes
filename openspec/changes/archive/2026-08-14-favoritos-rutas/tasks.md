## 1. Backend (`apps/api`)

- [x] 1.1 (TDD, en rojo primero) Test en `postgres_store_test.go` que confirma que `Upsert` persiste y devuelve `is_favorite` (3 tests: default `false`, persiste `true`/`false`, `ListByUser` lo incluye). Confirmado en rojo (`go vet` fallaba, campo inexistente).
- [x] 1.2 Migración `0007_add_route_favorite.sql`: `ALTER TABLE routes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;` (embebida automáticamente vía `//go:embed migrations`).
- [x] 1.3 Ampliado `Route`/`upsertRequest`/`UpsertHandler`/`postgres_store.go` (`Upsert`, `ListByUser`, `GetByIDForUser`) para aceptar y persistir `is_favorite` — tests de 1.1 en verde.
- [x] 1.4 `go test ./...` en verde (contra Postgres real, `internal/dbtest`).

## 2. Modelo y repositorio local (`apps/mobile`)

- [x] 2.1 Añadir `isFavorite: boolean` a `Route` (`shared/models/route.types.ts`). **Desviación deliberada del proposal**: no se añadió a `CreateRoute` — mismo criterio que `notes`/`previewPolyline`, que tampoco están ahí (son campos "solo actualización", nunca parte de la creación; `save()` los preserva del registro existente).
- [x] 2.2 Añadir `updateFavorite(routeId: string, isFavorite: boolean): Promise<void>` a `IRouteRepository`.
- [x] 2.3 (TDD, en rojo primero) Ampliada la suite de contrato compartida `createRouteSuite` (`shared/models/route.repository.spec.ts`) con `registerFavoriteTests` — corre automáticamente contra SQLite y Memory a la vez (5 tests: default false, persiste true/false, no-op en id inexistente, no se pierde en un `save()` posterior). Migración `is_favorite` con su propio describe dedicado en `sqlite-route.repository.spec.ts`, mismo patrón que `name`/`notes`.
- [x] 2.4 Implementado `SqliteRouteRepository.updateFavorite()` y `ensureColumn('is_favorite', 'INTEGER')` — mismo patrón que `updateNotes()`. 35/35 en `sqlite-route.repository.spec.ts`.
- [x] 2.5 Implementado `MemoryRouteRepository.updateFavorite()`. 29/29 en `memory-route.repository.spec.ts`.
- [x] 2.6 Incluido `isFavorite`/`is_favorite` en `route-cloud-api.service.ts` (tipos `CloudRouteSummary`/`CloudRouteSummaryResponse`, `uploadRoute`, `fetchCloudRoutes`, `fetchCloudRouteDetail`) y en los adaptadores `route-detail-cloud.transform.ts`/`route-list-sync.transform.ts`. 8/8 en verde.

## 3. Icono nuevo

- [x] 3.1-3.2 Icono nuevo `favorite-icons.ts` con su `.spec.ts` colocado. **Decisión de implementación (design.md D6 dejaba esto abierto)**: un único path de estrella, no dos iconos separados — el relleno (favorita/no favorita) se controla por CSS (`fill: currentColor` vs `fill: none`) según el estado, no duplicando el SVG. 1/1 test en verde.

## 4. UI: `route-detail`

- [x] 4.1 (TDD, en rojo primero) Toggle de favorito extraído a `shared/favorite-toggle.ts` (compartido con `route-list`, ver design.md — no vivía solo en `route-detail`). Test unitario del builder (5/5) + 5 tests de integración en `route-detail.element.spec.ts` (sin sesión → solo lectura, marcar, desmarcar, re-sube si sincronizada, no re-sube si es puramente local).
- [x] 4.2 Implementado el botón/indicador de favorito en `route-detail.element.ts`, cableado a `updateFavorite()` + `triggerAutoResync()` (design.md D3). **Hallazgo real, fuera de alcance**: una ruta exclusiva de la nube (nunca guardada localmente) hace `updateFavorite()` no-op silencioso — mismo gap ya existente en notas para el mismo caso, no arreglado aquí (documentado en el propio código). 58/58 en `route-detail.element.spec.ts`. **Ajuste real durante la implementación**: cablear el icono subió `route-detail.element.ts` a 415 líneas (`max-lines` del proyecto, límite 400). Se resolvió consolidando `buildHeader`/`buildSyncIcon`/`buildFavoriteIcon` (tres métodos privados) en un único fichero nuevo `route-detail-header.ts` (`buildDetailHeader()`), mismo patrón que `route-detail-notes.ts`/`route-detail-timeline.ts`, con su `.spec.ts` colocado (5 tests). `tsc --noEmit` y `eslint src/ --max-warnings 0` en verde tras el refactor.
- [x] 4.3 Cypress: 2 tests nuevos en `routes/route-cloud-sync.cy.ts` (no en `route-detail.cy.ts` — ese fichero no tiene el setup de cuenta/sesión real que este escenario necesita, mismo criterio que "subir a la nube" ya vive ahí). Marcar/desmarcar con verificación directa contra el servidor real (`is_favorite`), y el caso sin sesión. **Hallazgo real y corregido durante esta tarea**: mi primer intento de test sin sesión usaba un selector de clase (`.favorite-icon`), violando la regla del proyecto ("todo elemento localizable por un test lleva `data-cy`") — corregido el propio componente (`shared/favorite-toggle.ts`) para que el indicador de solo lectura también lleve `data-cy`, no solo el interactivo (ver design.md D5, corrección anotada ahí).

## 5. UI: `route-list`

- [x] 5.1 Resuelto `this._session: Session | null` en `route-list.element.ts` (`await this._sessionRepository?.get()` en `fetchAndRender()`, antes del primer render con datos), mismo patrón que `route-detail.element.ts` — primera vez que este componente gatea una acción por sesión (design.md D4).
- [x] 5.2 (TDD, en rojo primero) 8 tests nuevos en `route-list.element.spec.ts` (favorito por card: gating por sesión, indicador visible sin sesión, marcar/desmarcar, no navega al detalle, re-sube si sincronizada, no re-sube si es local) + filtro (4 tests: sin toggle sin rutas, oculta no-favoritas, estado vacío dedicado, restaura al desactivar). Confirmado en rojo antes de implementar.
- [x] 5.3 Implementado el icono de favorito por card, cableado a `updateFavorite()` + `triggerAutoResync()`. **Decisión real durante `apply` (no prevista en design.md D3)**: `triggerAutoResync`/`SyncTriggerContext` se reutilizan tal cual desde `routes/detail/route-detail-sync-triggers.ts` (import cruzado entre dominios `routes/list` → `routes/detail`) en vez de duplicar el mecanismo — son funciones puras sin acoplamiento a componentes, y el propio design.md pedía "cero mecanismo de sincronización nuevo".
- [x] 5.4 (TDD, en rojo primero) Tests incluidos en el mismo bloque que 5.2 (mismo fichero, mismo commit lógico — no había necesidad real de separarlos en dos rondas rojo/verde distintas).
- [x] 5.5 Implementado el filtro "Solo favoritas" (design.md D7): toggle en la cabecera, `.filter()` en memoria sobre `_items` ya cargado, estado vacío dedicado (`route-list-empty-favoritas`) cuando el filtro no deja ninguna card.
- [x] 5.6 Cypress: filtro completo en `route-list/route-list.cy.ts` (3 tests, sin sesión — el filtro seedea `isFavorite` directamente vía `repo.seed()`, no necesita login). El toggle de favorito por card sí necesita sesión real, así que ese test (marcar desde la lista sin entrar al detalle, verificado contra el servidor real) se añadió a `routes/route-cloud-sync.cy.ts` en vez de `route-list.cy.ts` — mismo criterio ya usado en la tarea 4.3 (ese fichero no tiene el setup de cuenta/sesión).
- [x] 5.3b **Ajuste real durante la implementación**: cablear el icono + filtro subió `route-list.element.ts` por encima de `max-lines` (300 líneas, límite genérico del proyecto — `route-detail.element.ts` tiene una excepción a 400 en `eslint.config.js`, este fichero no). Se resolvió extrayendo `route-list-favorite.ts` (icono de favorito por card + toggle del filtro) con su `.spec.ts` colocado (6 tests), mismo patrón que `route-detail-favorite.ts`/`route-detail-header.ts`. `tsc --noEmit` y `eslint src/ --max-warnings 0` en verde tras el refactor.

## 6. Verificación end-to-end

- [x] 6.1 `pnpm exec vitest run --coverage`: 1086/1086 tests, umbral 80% (líneas/funciones/branches/statements) superado (`success: true`, sin fallo de threshold).
- [x] 6.2 `pnpm run test:e2e` (Cypress completo) en verde: 60/60, contra `apps/api` real (Docker). **Nota real**: la imagen `docker-api-1` estaba desactualizada (construida antes de añadir la migración `0007_add_route_favorite.sql`) — hubo que `docker compose build api && docker compose up -d api` para que el backend real aplicara la columna nueva antes de correr la suite. `go test ./...` (113 tests) también en verde tras el rebuild.
- [x] 6.3 `tsc --noEmit` y `eslint src/ --max-warnings 0` en verde (corridos explícitamente varias veces durante `apply`, no solo al final).
- [x] 6.4 Verificación en dispositivo real: marcar/desmarcar favorita desde el detalle y desde la lista, activar el filtro, cerrar y reabrir la app confirma que el estado persiste localmente, y que se re-sincroniza tras reconectar si se marcó sin conexión. Confirmado por el usuario, sin hallazgos.

## 7. Cierre

- [x] 7.1 Actualizar `memory/context.md` (§ Estado Actual del Proyecto) con un resumen de la sesión.
- [x] 7.2 Revisar el diff completo buscando cualquier string de secreto antes de abrir la PR. Sin hallazgos — solo nombres de variable (`token`) y valores dummy de test (`'jwt-token'`).
