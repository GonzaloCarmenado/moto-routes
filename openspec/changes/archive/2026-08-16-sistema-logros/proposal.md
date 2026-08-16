## Why

La app registra kilómetros, duración y número de rutas por usuario desde hace tiempo, pero no reconoce ni celebra ningún hito ante el usuario — todo ese progreso queda invisible salvo que el usuario lo calcule mentalmente desde el listado de rutas. Un sistema de logros da un motivo de vuelta a la app (ver el propio progreso, perseguir el siguiente hito) reutilizando datos que el backend ya almacena en `routes` (`total_distance`, `duration`), sin necesitar tracking nuevo.

## What Changes

- Nueva capability backend: catálogo de logros (tabla de datos, no hardcodeado en código — título, icono, descripción breve, tipo de requisito y umbral) y logros otorgados por usuario con fecha de consecución.
- Nuevo endpoint que, dado el usuario autenticado, calcula sus agregados actuales sobre `routes` (km totales, nº de rutas, ruta más larga, km del mes natural en curso) y devuelve qué logros del catálogo cumple que **todavía no tuviera otorgados** — otorgándolos de forma idempotente en la misma llamada (no se puede otorgar dos veces el mismo logro al mismo usuario).
- El cliente llama a ese endpoint justo después de que `uploadRouteToCloud()` confirme una sincronización con éxito (subida manual inicial o auto-resync tras editar notas/fotos) — único punto de confirmación de sync que ya existe hoy. Si la llamada devuelve logros nuevos, se muestran en cola, uno completo tras otro (título + descripción + icono), con una animación de desbloqueo nueva.
- Icono: una única imagen placeholder genérica para todos los logros por ahora (campo `icon` en el modelo, personalización por logro queda para un cambio futuro).
- Nueva pantalla "Mis logros" accesible desde la cuenta de usuario: logros conseguidos (con fecha) y logros pendientes con el progreso actual hacia su umbral (ej. "320/500 km").
- Los logros conseguidos son permanentes: no se revocan si después se borra una ruta que contribuyó a conseguirlos (los agregados solo se recalculan hacia adelante, nunca hacia atrás).
- Solo cuentan rutas ya sincronizadas a la nube — una ruta local sin sincronizar no contribuye a ningún agregado hasta que se sube.
- Catálogo inicial (seed vía migración, ajustable después sin tocar código): 3 escalones de km totales (100/500/1500 km), 1 logro de "ruta larga" (>60 min en una sola ruta), 3 escalones de km en el mes natural en curso (100/300/500 km), 3 escalones de nº de rutas grabadas (5/25/100 rutas).

## Capabilities

### New Capabilities
- `logros`: catálogo de logros, cálculo de agregados por usuario, otorgamiento idempotente, endpoint de comprobación tras sync, pantalla "Mis logros" y animación de desbloqueo en el cliente.

### Modified Capabilities
(ninguna — no cambia el comportamiento observable de `route-cloud-sync` ni de ninguna capability existente; solo se le añade una llamada adicional después de una sincronización con éxito, que es un detalle de implementación sin requisito de spec afectado)

## Impact

- **Backend** (`apps/api/`): paquete nuevo `internal/achievements/` (mismo patrón de 4 ficheros que `internal/routesharing/`: tipos+store interface, `postgres_store.go`, `handler.go`, lógica de otorgamiento); migración nueva `0009_create_achievements.sql` (tablas `achievements` catálogo + `user_achievements` otorgados, con seed de datos); registro en `apps/api/cmd/api/main.go` siguiendo el patrón ya documentado ahí (CORS + `OPTIONS` explícito por ruta, ver PR #123).
- **Frontend** (`apps/mobile/src/`): dominio nuevo `src/achievements/` (pantalla `<achievement-list>` con progreso, mismo patrón de card-grid que `route-sharing.element.ts`); overlay nuevo `achievement-unlock-overlay.element.ts` en `src/shared/feedback/` (junto a `toast.ts`/`confirm-dialog.element.ts`); hook de comprobación añadido en `route-detail-cloud.service.ts` justo después de que `uploadRouteToCloud()` resuelva con éxito; acceso nuevo desde `src/profile/` (icono/entrada "Mis logros").
- **Sin impacto** en `apps/mobile/src-tauri/` (Rust) ni en el modelo SQLite local — los agregados viven enteramente en Postgres sobre datos ya sincronizados.
