## Why

Con rutas ya ligadas a la cuenta (`route-cloud-sync`, ADR-040) y accesibles desde cualquier dispositivo, el listado crece con el uso y no hay forma de destacar las rutas que el usuario quiere volver a consultar fácilmente — solo el orden cronológico. Marcar una ruta como favorita, ligada a la cuenta y no al dispositivo, resuelve esto sin necesitar ninguna infraestructura nueva: reutiliza exactamente el mecanismo de re-sincronización automática que ya existe para notas y fotos.

## What Changes

- Nuevo campo `isFavorite` en el modelo `Route`, persistido local (SQLite) y en la cuenta (`apps/api`, tabla `routes`).
- Icono de favorito (estrella) en `route-list` (cada card) y en `route-detail` — toggle directo, sin confirmación. Solo visible con sesión activa (mismo criterio que "Subir a la nube"): en una ruta local sin sesión, el icono no se muestra.
- Marcar/desmarcar favorita en una ruta ya sincronizada la re-sube sola a la nube, igual que ya ocurre con las notas — nuevo escenario sobre el requirement existente de re-sincronización automática, sin mecanismo nuevo.
- Filtro "Solo favoritas" en `route-list` (chip/toggle), oculta el resto de la lista sin filtro adicional (búsqueda por texto, si existiera, queda fuera de alcance).
- Icono nuevo de estrella en el sistema de iconos SVG sobrio (`src/shared/icons/`, ADR-046), mismo patrón que sus hermanos (SVG inline + `.spec.ts` colocado).

## Capabilities

### New Capabilities
- `favoritos-rutas`: marcar/desmarcar una ruta como favorita ligada a la cuenta, con gating por sesión activa y filtro en el listado.

### Modified Capabilities
- `route-cloud-sync`: el requirement "Una ruta ya sincronizada se actualiza sola en la nube al modificarla localmente" gana un escenario nuevo — marcar/desmarcar favorita dispara la misma re-subida automática que ya disparan notas y fotos.

## Impact

- `apps/mobile/src/shared/models/route.types.ts`: campo `isFavorite: boolean` en `Route` (y en `CreateRoute`).
- `apps/mobile/src/shared/models/route.repository.ts`: nuevo método `updateFavorite(routeId, isFavorite): Promise<void>` en `IRouteRepository`, mismo patrón que `updateNotes`.
- Implementaciones del repositorio (SQLite local + adaptador de subida a `apps/api`) — a detallar en `design.md`.
- `apps/mobile/src/routes/list/route-list.element.ts` (icono de estrella por card + filtro "Solo favoritas") y `apps/mobile/src/routes/detail/route-detail.element.ts` (icono de estrella en el detalle).
- `apps/mobile/src/shared/icons/`: icono nuevo de estrella.
- `apps/api/internal/migrate/migrations/`: migración nueva, columna `is_favorite BOOLEAN NOT NULL DEFAULT false` en `routes`.
- `apps/api/internal/routes/handler.go` (`UpsertHandler`) y `postgres_store.go`: aceptar y persistir el campo nuevo en el upsert ya existente — sin endpoint nuevo.
- `openspec/specs/route-cloud-sync/spec.md`: delta spec por el escenario nuevo de re-sincronización.
- Sin cambios en autenticación, permisos ni en el resto de `apps/api` más allá de la columna y el upsert.
