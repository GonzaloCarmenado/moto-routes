## Why

Hoy las paradas de una ruta no se persisten en absoluto: `route_stops` existe en el esquema SQLite pero `buildStops()` (`apps/mobile/src/cockpit/persist/cockpit-persist.service.ts:50`) siempre devuelve `[]` con el comentario explícito "Por ahora sin detección de paradas implementada". El timeline de detalle de ruta (`route-timeline.transform.ts`) recalcula paradas de forma efímera a partir de los puntos GPS en cada visualización, incluyendo cualquier parada breve (un semáforo, un cruce) como si fuera relevante. No existe ningún catálogo de categorías de parada (bar, mirador, monumento, gasolinera…) en ningún sitio del proyecto — ni en `apps/api` ni en `apps/mobile` ni en `specs/features/` (histórico congelado).

Este cambio construye esa pieza que falta: un catálogo de tipos de parada servido por `apps/api`, y en `apps/mobile` la posibilidad real de marcar una parada intencional durante la grabación, asignarle un tipo, y verla distinguida en el mapa y el timeline — mientras que las paradas detectadas automáticamente (semáforos, tráfico) siguen sin mostrarse, tal y como ya es el caso hoy en la práctica (nunca se persisten).

## What Changes

- **Backend (`apps/api`)**: nueva tabla `stop_types` (primera tabla de dominio del backend aparte de `users`) con un catálogo fijo del sistema (texto + icono). Nuevo endpoint `GET /api/stop-types`, **público, sin autenticación** — dato de referencia no sensible; si en el futuro se permiten tipos personalizados por usuario, esa escritura sí iría protegida con `user-auth` (explícitamente fuera de alcance de este cambio).
- **Móvil — primera llamada real a `apps/api`**: `apps/mobile` nunca ha hecho una petición HTTP a `apps/api` hasta ahora. Se añade un cliente HTTP mínimo y se cachea el catálogo en una tabla SQLite local nueva (`stop_types_cache`), para que el modal funcione sin conexión en carretera — coherente con que el resto de la app es local-first.
- **Móvil — marcar una parada manual**: nuevo control en la pantalla de grabación (`cockpit`) que el usuario pulsa deliberadamente al hacer una parada real. Al pulsarlo se abre un modal para elegir el tipo (del catálogo cacheado). La parada se persiste en `route_stops` con su tipo — primera implementación real de `buildStops()`, hasta ahora un stub.
- **Móvil — paradas automáticas sin cambios de comportamiento propios**: la detección GPS ya existente (`detectStop()`, `stopState`) sigue funcionando igual para su propósito actual (indicador en vivo); **no** dispara el modal, **no** se persiste en `route_stops`, y por tanto **no** aparece en el timeline ni en el mapa — mismo resultado práctico que hoy (nunca se guardan), ahora explícito y a propósito en vez de un efecto colateral de que `buildStops()` esté sin implementar.
- **Móvil — previsualización**: el timeline de detalle de ruta deja de recalcular delimitadores "parada" a partir de los puntos GPS (comportamiento actual) y pasa a leer las paradas manuales reales de `route_stops`, mostrando el icono de su tipo. El mapa (`shared/route-map/`) distingue cada tipo de parada con su icono, igual que ya distingue clusters de fotos.
- **BREAKING** (interno, sin usuarios reales todavía en producción salvo pruebas): el comportamiento del timeline cambia — una parada que hoy aparece siempre (aunque sea un semáforo) deja de mostrarse salvo que el usuario la haya marcado y tipado.

## Capabilities

### New Capabilities
- `stop-types-catalog`: catálogo de tipos de parada servido por `apps/api` (tabla + endpoint público) y cacheado localmente por `apps/mobile`.
- `cockpit-manual-stops`: marcar una parada manual durante la grabación, elegir su tipo en un modal, y persistirla — dominio `cockpit`.
- `route-stop-types-display`: el timeline y el mapa de detalle de ruta distinguen visualmente cada tipo de parada y excluyen las paradas sin tipo — dominio `routes`.

### Modified Capabilities
(ninguna — no hay capabilities de OpenSpec existentes sobre `routes`/`cockpit`/timeline; ese dominio vivía solo en `specs/features/` histórico y congelado, no se toca)

## Impact

- **Backend**: `apps/api/internal/stoptypes/` (paquete nuevo: handler + repositorio), `apps/api/internal/migrate/migrations/0002_create_stop_types.sql`, wiring en `apps/api/cmd/api/main.go` (nueva ruta pública, sin `RequireAuth`).
- **Móvil — cockpit**: `apps/mobile/src/cockpit/cockpit.types.ts` (`Stop` gana un campo de tipo/categoría, distinto del `type: 'manual'|'auto'` ya existente que indica el origen de la detección, no la categoría), `apps/mobile/src/cockpit/cockpit.service.ts`, nuevo control UI + nuevo componente modal (con su `data-cy`), `apps/mobile/src/cockpit/persist/cockpit-persist.service.ts` (`buildStops()` deja de ser un stub).
- **Móvil — routes**: `apps/mobile/src/routes/detail/route-detail-timeline.ts`, `route-timeline.transform.ts` (deja de recalcular desde puntos GPS, lee `route_stops`), `apps/mobile/src/shared/route-map/` (iconos por tipo).
- **Móvil — persistencia**: `apps/mobile/src/shared/repositories/sqlite-route.repository.ts` (columna nueva en `route_stops`, tabla nueva `stop_types_cache`), `apps/mobile/src/shared/models/route.types.ts` (`RouteStop`/`CreateRouteStop`).
- **Móvil — HTTP**: primer cliente HTTP real hacia `apps/api` (hoy `apps/mobile/src/shared/http/` solo tiene `external-api.service.ts` para una API externa distinta, ver [[ADR-028]]) — nueva entrada en `connect-src` de la CSP (`tauri.conf.json` + `index.html`) con el host de `apps/api`.
- **specs/features/**: sin cambios (histórico congelado, no se amplía).
