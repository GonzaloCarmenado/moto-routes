## Context

Ver `proposal.md` - Why para la motivación completa. Puntos de partida técnicos relevantes para el "cómo":

- `apps/mobile` es local-first (SQLite vía `@tauri-apps/plugin-sql`) y **nunca ha llamado a `apps/api`**. El único cliente HTTP existente (`external-api.service.ts`, `fetch` nativo, sin dependencia nueva) apunta a una API pública externa (NHTSA vPIC, [[ADR-028]]), no a nuestro propio backend.
- `apps/api` en producción solo escucha en la interfaz de Tailscale del servidor ([[ADR-033]]) — no es alcanzable desde una red pública ni desde la LAN doméstica del servidor.
- `Stop` (`apps/mobile/src/cockpit/cockpit.types.ts`) ya tiene un campo `type: 'manual' | 'auto'` que indica el **origen** de la detección, no una categoría — hay que evitar la colisión de nombre con el tipo de parada de este cambio.
- `route_stops` (SQLite) existe en el esquema pero está vacía en la práctica: `buildStops()` es un stub que siempre devuelve `[]`.
- El timeline (`route-timeline.transform.ts`) recalcula paradas de forma efímera a partir de `route_points` en cada visualización — no lee `route_stops`.

## Goals / Non-Goals

**Goals:**
- Servir el catálogo de tipos de parada desde `apps/api` y consumirlo desde `apps/mobile` con caché local para uso sin conexión.
- Implementar por primera vez la persistencia real de paradas manuales (`buildStops()` deja de ser un stub).
- Distinguir tipos de parada en timeline y mapa, mostrando solo paradas con tipo asignado.

**Non-Goals:**
- Tipos de parada personalizados por usuario (confirmado fuera de alcance con el usuario).
- Cambiar el comportamiento de la detección automática GPS en vivo (`stopState`/`detectStop()`) más allá de que ya no dispare persistencia ni modal — su indicador visual en la grabación, si lo tiene hoy, no se toca.
- Hacer `apps/api` alcanzable desde fuera de la red Tailscale — ver Risks.

## Decisions

Las decisiones duraderas de este cambio (estrategia de URL base del backend, representación del icono, y el cambio del timeline de "recalculado" a "leído de BD") están registradas en [[ADR-035]] (`memory/decisions.md`), con sus alternativas descartadas — no se duplican aquí.

**Nombrado del campo nuevo**: `Stop`/`RouteStop` ganan `stopTypeId: string | null` (referencia al catálogo), distinto y compatible con el `type: 'manual' | 'auto'` ya existente (origen de la detección). Una parada manual siempre tiene `stopTypeId` no nulo (el modal es obligatorio para persistirla); una parada nunca persistida (auto) no existe como fila, así que la columna nunca es nula en la práctica — se declara nullable solo por robustez del esquema, no porque se espere ese estado.

**Endpoint**: `GET /api/stop-types`, sin middleware `RequireAuth` (único endpoint público de `apps/api` además de `/api/ping`). Responde `[{id, key, label, icon}]`.

**Migraciones**: `apps/api/internal/migrate/migrations/0002_create_stop_types.sql` crea la tabla y siembra el catálogo inicial (bar/restaurante, mirador, monumento, gasolinera, alojamiento, taller/mecánico, aparcamiento, otro) — mismo runner ya existente (ADR-034), sin dependencia nueva.

## Risks / Trade-offs

- [Riesgo] `apps/api` solo es alcanzable por Tailscale ([[ADR-033]]) — un teléfono que no esté en el mismo tailnet nunca podrá sincronizar el catálogo (solo la caché local ya descargada, si existe). Aceptado porque hoy el único usuario real de la app es quien también administra el servidor y puede unir su teléfono al tailnet; revisar si la app llega a tener usuarios externos reales, momento en el que `apps/api` necesitará alguna forma de exposición pública — no es objetivo de este cambio.
- [Riesgo] Cambiar el timeline de "recalcula desde GPS" a "lee `route_stops`" es un cambio de comportamiento observable sobre `specs/features/timeline-ruta.md` (histórico congelado, no se edita, pero el comportamiento real diverge de él a partir de este cambio) → Mitigación: documentado explícitamente en `proposal.md` como **BREAKING** interno; sin usuarios reales con rutas ya grabadas que dependan del delimitador "parada" antiguo.
- [Riesgo, `src/shared/`] `shared/route-map/` y `shared/repositories/sqlite-route.repository.ts` se tocan — radio de impacto sobre todo lo que ya consume el mapa (fotos, `route-detail`) y el repositorio (route-list, profile). Mitigación: cambios aditivos (columna nueva, iconos nuevos), sin romper la forma actual de `RouteStop` para quien no pida el campo nuevo.
- [Riesgo] Primera vez que `apps/mobile` depende de que `apps/api` esté disponible para algo (aunque sea opcional/cacheado) → Mitigación: estrictamente best-effort, con caché local — la app SHALL seguir funcionando sin red y sin `apps/api` disponible (ver specs de `stop-types-catalog`).

## Migration Plan

1. Backend: migración `0002_create_stop_types.sql` + endpoint, desplegado primero (no rompe nada existente, tabla/ruta nuevas).
2. Móvil: columna nueva en `route_stops` + tabla `stop_types_cache` (mismo patrón `ensureColumn`/`CREATE TABLE IF NOT EXISTS` ya usado en `sqlite-route.repository.ts`), sin migración destructiva.
3. UI (control de marcar parada + modal) y cambio del timeline/mapa, en ese orden — el timeline no debe cambiar de comportamiento hasta que exista al menos la posibilidad real de persistir una parada manual.
4. Sin rollback especial: todo es aditivo salvo el cambio de comportamiento del timeline, que se revierte trivialmente (volver a leer de `route_points` en vez de `route_stops`) si hiciera falta.
