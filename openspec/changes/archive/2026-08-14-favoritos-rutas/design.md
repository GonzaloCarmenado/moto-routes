## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico ya investigado durante `propose`:

- El mecanismo de re-sincronización automática ya existe y es genérico: `route-detail.element.ts` llama a `triggerAutoResync(ctx: SyncTriggerContext, route)` (definido en `route-detail-sync-triggers.ts`) tras cualquier mutación local de una ruta (hoy: notas). `triggerAutoResync` no hace nada sin sesión/repositorio, y delega en `autoResyncIfNeeded` (`route-detail-cloud.service.ts`) el upsert completo si `isSynced`. Favoritos reutiliza esto tal cual — cero mecanismo de sincronización nuevo.
- El patrón de persistencia local de un campo independiente ya existe: `IRouteRepository.updateNotes(routeId, notes)` → `SqliteRouteRepository.updateNotes()` (`sqlite-route.repository.ts:237`) hace un `UPDATE routes SET notes = ? WHERE id = ?` simple. El esquema local se migra de forma perezosa e idempotente con `ensureColumn(name, sqlType)` (comprueba `PRAGMA table_info` antes de `ALTER TABLE`, patrón ya usado para `notes`/`name`/`preview_polyline`).
- `route-detail.element.ts` ya resuelve una `Session` real (no solo el repositorio) en su carga (`this._session = await this._sessionRepository?.get()`) para gatear "Subir a la nube". **`route-list.element.ts` no lo hace hoy** — tiene `_sessionRepository` (para leer rutas de la nube vía `loadRouteListItems`), pero ninguna acción interactiva gateada por sesión todavía. Añadir el toggle de favorito en la lista es la primera acción de este tipo ahí — hay que replicar el mismo patrón de resolución de sesión que ya existe en `route-detail`.
- `RouteListItem { route: Route; syncState: RouteSyncState }` (`route-list-sync.transform.ts`) ya lleva la `Route` completa por card — el campo `isFavorite` llega gratis en cuanto se añada a `Route`, sin tocar el merge local/nube.

## Goals / Non-Goals

**Goals:**
- Reutilizar el mecanismo de re-sincronización y el patrón de persistencia de campo independiente ya existentes, sin construir nada nuevo en el backend más allá de una columna y aceptarla en el upsert.
- Que el estado de favorito sea legible siempre (con o sin sesión) y solo editable con sesión activa — decisión ya confirmada con el usuario.

**Non-Goals:**
- Ningún endpoint nuevo en `apps/api` (el upsert ya existente absorbe el campo).
- Ningún filtro de texto/búsqueda en el listado — solo el toggle "Solo favoritas".
- Compartir rutas / visibilidad pública (`RouteVisibility.public`) — spec futura separada, ya decidida con el usuario.

## Decisions

### D1: `Route.isFavorite: boolean`, persistencia local con el mismo patrón que `notes`
`SqliteRouteRepository`: `ensureColumn('is_favorite', 'INTEGER')` (SQLite no tiene booleano nativo — se guarda 0/1, se traduce a `boolean` en la capa de lectura, mismo criterio que cualquier otro flag ya existente en el esquema). Nuevo método `updateFavorite(routeId: string, isFavorite: boolean): Promise<void>` en `IRouteRepository`, implementado en `SqliteRouteRepository` y `MemoryRouteRepository`, mismo patrón exacto que `updateNotes`.

### D2: Backend — columna nueva, sin endpoint nuevo
Migración nueva en `apps/api/internal/migrate/migrations/` (siguiente número tras `0006_create_route_photos.sql`): `ALTER TABLE routes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;`. `UpsertHandler`/`postgres_store.go` amplían el `INSERT ... ON CONFLICT DO UPDATE` ya existente para incluir la columna — mismo statement, un campo más. Sin endpoint `PATCH` dedicado: el favorito viaja en el próximo upsert completo, igual que las notas.
**Alternativa descartada**: tabla aparte `route_favorites (user_id, route_id)` — habría tenido sentido si una ruta pudiera pertenecer a varias cuentas (caso de "compartir", fuera de alcance), pero hoy cada ruta tiene un único `user_id` dueño — una columna simple en `routes` es la opción más simple que resuelve el caso real.

### D3: Re-sincronización — reutilizar `triggerAutoResync` sin cambios
`route-detail.element.ts`: tras `updateFavorite()`, llamar a `triggerAutoResync(this.syncContext(), route)` — misma línea que ya usa `handleSaveNote`. `route-list.element.ts`: necesita su propio `SyncTriggerContext` equivalente (sesión + repositorio + `isSynced` del item concreto, derivable de `item.syncState !== 'local'`) para poder disparar el mismo trigger desde una card sin pasar por el detalle.

### D4: `route-list.element.ts` resuelve una `Session` real, mismo patrón que `route-detail`
Añadir `this._session: Session | null` resuelto vía `await this._sessionRepository?.get()` en el mismo punto donde hoy se llama a `loadRouteListItems` (antes de renderizar), para gatear el icono de favorito por card y poder construir el `SyncTriggerContext` de D3. Es la primera acción interactiva gateada por sesión en este componente — no existe hoy.

### D5: Icono de favorito always-visible (lectura) / gateado (acción) — un solo elemento, dos comportamientos
El icono de estrella se renderiza siempre que `route.isFavorite` es relevante (relleno si `true`), pero solo lleva `addEventListener('click', ...)` cuando hay sesión — sin sesión, se renderiza como `<span>` no interactivo (sin listener, sin cursor pointer) en vez de `<button>`, mismo elemento visual, distinto comportamiento. **Corrección real durante `apply`**: el `data-cy` se mantiene en los dos casos (interactivo o no) — la regla del proyecto exige `data-cy` en todo elemento "interactivo o localizable por un test", y el indicador de solo lectura es justo eso, localizable aunque no accionable; la redacción original de esta decisión (solo `data-cy` con sesión) violaba esa regla y se detectó al escribir el propio test E2E. Confirmado con el usuario: el indicador de lectura nunca se oculta, solo la acción de tocarlo.

### D6: Icono nuevo en el sistema SVG sobrio (ADR-046)
Estrella de contorno/relleno (`currentColor`, 2 estados vía CSS o dos paths), en `src/shared/icons/` (fichero propio `favorite-icons.ts` o añadido a `action-icons.ts` — decisión de implementación menor, a resolver en `apply`), con su `.spec.ts` colocado siguiendo el mismo test que sus hermanos (`action-icons.spec.ts`, `cloud-sync-icons.spec.ts`).

### D7: Filtro "Solo favoritas" — cliente, sobre los datos ya cargados
`route-list.element.ts` ya tiene en memoria `RouteListItem[]` completo (local + nube fusionado) antes de renderizar. El filtro es un `.filter(item => item.route.isFavorite)` aplicado en el propio componente al renderizar, sin ninguna petición nueva al backend ni a SQLite — el estado del toggle vive en el propio componente (no persistido entre sesiones de la app, se resetea al reabrir).

## Risks / Trade-offs

- [Riesgo] Añadir un session-gating nuevo a `route-list.element.ts` (D4) puede introducir una condición de carrera entre la resolución async de la sesión y el primer render, similar en espíritu al bug real ya documentado del overlay de permiso GPS (ADR-037) → Mitigación: replicar el mismo orden ya probado en `route-detail` (resolver sesión antes de construir las cards, no en paralelo con el primer render).
- [Riesgo] El filtro "Solo favoritas" no persistido entre aperturas de la app podría sorprender a quien lo esperaba recordado → Mitigación: aceptado como comportamiento inicial simple (confirmado en el alcance con el usuario); si se pide luego, es un cambio pequeño (guardar el toggle en `localStorage`).
- [Riesgo] `MemoryRouteRepository.updateFavorite()` debe mantenerse en paralelo a `SqliteRouteRepository.updateFavorite()` (mismo patrón que `updateNotes` ya exige hoy) — riesgo de que diverjan si solo se actualiza una implementación → Mitigación: test compartido de la interfaz `IRouteRepository` si existe ya ese patrón en el proyecto (comprobar en `apply`), si no, test dedicado por implementación como ya hay para `updateNotes`.

## Migration Plan

Migración de esquema aditiva y retrocompatible en ambos lados: `ALTER TABLE ... ADD COLUMN ... DEFAULT false` en Postgres (rutas existentes quedan `is_favorite = false`), y `ensureColumn` perezoso en SQLite local (se aplica la primera vez que la app toca la tabla tras actualizar, sin migración explícita de versión). Sin rollback especial: revertir el PR basta, la columna nueva no rompe nada que la ignore.
