## Why

El header del listado de rutas (`apps/mobile/src/routes/list/route-list.element.ts`) ha ido acumulando controles de forma incremental — el botón de invitaciones (`compartir-ruta`, icono redondo) y el filtro "Solo favoritas" (`favoritos-rutas`, chip de texto) se apilan uno debajo del otro en vez de convivir en una fila, con dos lenguajes visuales distintos (icono vs texto) para el mismo tipo de control. Además, el estado de sincronización (local / sincronizada / solo en la nube, `route-cloud-sync`) hoy solo se ve por tarjeta — no hay forma de filtrar por él — y no existe ningún buscador por nombre ni control de orden: el listado siempre se muestra por fecha de creación descendente, fijado en `sqlite-route.repository.ts` y reforzado en `route-list-sync.transform.ts`.

## What Changes

- El filtro "Solo favoritas" pasa de chip de texto a icono (estrella), mismo patrón visual que el botón de invitaciones — ambos conviven en una sola fila de controles en el header.
- Dos filtros nuevos, icono-toggle, combinables con el de favoritas: "Solo locales" y "Solo en la nube", basados en el `RouteSyncState` que ya existe por tarjeta (`local` | `synced` | `cloud-only`).
- Buscador por nombre: campo de texto que filtra el listado en vivo mientras se escribe, coincidencia por nombre de ruta.
- Ordenación: control Fecha/Nombre (Fecha como hoy, descendente; Nombre A-Z), sustituye al orden fijo actual.
- Todos los filtros/búsqueda/orden se combinan entre sí (AND) sobre la lista ya fusionada local+nube, sin persistir entre aperturas de la app — mismo criterio ya establecido para "Solo favoritas".

## Capabilities

### New Capabilities
- `listado-rutas`: filtros combinables por estado de sincronización (local/nube), buscador por nombre en vivo, y ordenación por fecha o nombre en el listado de rutas.

### Modified Capabilities
(ninguna — el cambio de "Solo favoritas" de texto a icono es presentación, no requisito: el spec de `favoritos-rutas` describe el comportamiento del filtro, no su forma visual, y ese comportamiento no cambia)

## Impact

- `apps/mobile/src/routes/list/route-list.element.ts` — layout del header (fila de controles), estado del componente (búsqueda, orden, filtros local/nube), lógica de filtrado combinado.
- `apps/mobile/src/routes/list/route-list-favorite.ts` — `buildFavoritesFilterToggle()` pasa de texto a icono.
- `apps/mobile/src/routes/list/route-list.element.css` — nueva fila de controles (flex), estilos de los dos iconos nuevos reutilizando `.favorite-icon`, campo de búsqueda, control de orden.
- Nuevo fichero de lógica pura (filtrado combinado + comparador de orden), extraído si `route-list.element.ts` supera el límite de líneas del proyecto (ya cerca del límite tras los cambios de `sistema-logros`/`auditoria-tecnica-2026-08`).
- `apps/mobile/src/shared/icons/cloud-sync-icons.ts` — reutiliza `DEVICE_ICON`/`CLOUD_CHECK_ICON`/`CLOUD_ONLY_ICON` ya existentes, sin icono nuevo.
- Sin cambios de backend (`apps/api`), sin dependencias nuevas, sin cambios de esquema SQLite — todo el filtrado/orden nuevo opera en memoria sobre datos ya cargados, igual que el filtro de favoritas existente.
