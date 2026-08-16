## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico relevante para el "cómo":

- `routes` (`apps/api/internal/migrate/migrations/0005_create_routes.sql`) ya guarda `total_distance` y `duration` precalculados por ruta (el cliente los envía al subir), y `created_at` como **`TEXT` libre**, no `TIMESTAMPTZ` — el cliente manda un ISO 8601 (`"2026-08-07T10:00:00.000Z"`, ver `handler_test.go:80`) pero la columna no lo valida ni lo tipa.
- No existe hoy ninguna query de agregados (`SUM`/`COUNT`) sobre `routes`; `ListByUser`/`GetByIDForUser` son consultas fila a fila (`postgres_store.go:120-171`).
- No hay auto-sync tras parar de grabar (confirmado investigando antes de esta propuesta): la subida inicial es el botón manual "Subir a la nube" (`route-detail-cloud-upload.ts:47-58`, `handleUpload`) y el auto-resync tras editar notas/fotos (`route-detail-sync-triggers.ts`, `triggerAutoResync`/`autoResyncIfNeeded`) solo re-sube una ruta que ya estaba sincronizada. Ambos caminos convergen en `uploadRouteToCloud()` (`route-detail-cloud.service.ts`) — es el único punto real de "esta ruta acaba de sincronizarse con éxito" que existe en el cliente hoy.
- Patrón de referencia para un paquete backend nuevo con tabla propia + handlers: `internal/routesharing/` (4 ficheros: tipos+store interface, `postgres_store.go`, `handler.go`, lógica de orquestación separada). Patrón de referencia para el registro en `main.go`: CORS (`httpmw.PublicCORS`) + `OPTIONS` explícito por ruta (comentario en `main.go:103-109`, y el bug real de PR #123 que motivó documentarlo).
- Patrón de referencia frontend para una pantalla de "lista con estado" dentro de cuenta: `route-sharing.element.ts` (tabs + card-builder). No existe hoy ningún overlay/animación de celebración — el precedente más cercano es `showToast()` (`shared/feedback/toast.ts`), pero es demasiado discreto para lo que pide esta spec (título+descripción+icono, atención completa).

## Goals / Non-Goals

**Goals:**
- Modelo de datos 100% dirigido por datos (catálogo en tabla, no en código) para los 4 tipos de requisito iniciales.
- Comprobación de logros sin infraestructura nueva (sin websockets, sin cron, sin colas) — se apoya en el único punto de sincronización ya existente.
- Reutilizar el patrón ya establecido de paquete backend (`routesharing`) y de pantalla de cuenta (`route-sharing`).

**Non-Goals:**
- Personalización de icono por logro (queda para un cambio futuro; el campo existe pero todos apuntan al mismo asset placeholder).
- Recalcular o revocar logros ya otorgados (decisión ya tomada: permanentes).
- Soporte de zona horaria por usuario para el "mes natural" — se usa la zona del servidor (ver Decisión 5).
- Cualquier disparo de la comprobación de logros fuera del flujo de sincronización de rutas (no se añade un botón "comprobar logros" independiente ni se comprueban al abrir la app).

## Decisions

### 1. Dos tablas nuevas: catálogo (`achievements`) + otorgados (`user_achievements`)
Mismo patrón que `stop_types` (catálogo `BIGSERIAL` + `key TEXT UNIQUE` sembrado por la propia migración, ver `0002_create_stop_types.sql`) en vez de UUID generado en Go — más simple para un catálogo pequeño gestionado por el equipo, sin necesitar `uuid.NewString()` en el `INSERT` de seed. `achievements`: `id BIGSERIAL PK`, `key TEXT UNIQUE` (slug estable, ej. `total_km_500`), `requirement_type TEXT` (`total_distance_km` | `monthly_distance_km` | `route_count` | `single_route_duration_seconds`), `threshold DOUBLE PRECISION`, `title TEXT`, `description TEXT`, `icon TEXT` (identificador simbólico, no URL — ver Decisión 6), `created_at TIMESTAMPTZ DEFAULT now()`. `user_achievements`: `id BIGSERIAL PK`, `user_id BIGINT REFERENCES users(id) ON DELETE CASCADE`, `achievement_id BIGINT REFERENCES achievements(id) ON DELETE CASCADE`, `achieved_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE (user_id, achievement_id)`.
**Alternativa descartada**: una sola tabla con `user_id` nullable para representar "catálogo vs otorgado". Mezclaría dos entidades con ciclo de vida distinto (el catálogo lo gestiona el equipo, lo otorgado lo genera el sistema) — más difícil de razonar y de indexar.

### 2. Idempotencia garantizada por constraint de BBDD, no solo por lógica de aplicación
El `UNIQUE (user_id, achievement_id)` + `INSERT ... ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING *` es lo que hace real la garantía "nunca se otorga dos veces", igual que ya se hace con las transiciones atómicas `UPDATE ... WHERE status = 'pending'` de `routesharing` (`MarkAccepted`/`MarkDeclined`). Evita una condición de carrera real si el cliente reintenta la comprobación (p. ej. tras un timeout) mientras la primera petición todavía no ha terminado.

### 3. Dos endpoints, mismo helper de agregados
- `POST /api/achievements/check` (auth requerida): calcula agregados del usuario, evalúa el catálogo completo contra lo ya otorgado, inserta lo nuevo (`ON CONFLICT DO NOTHING`), devuelve solo los logros **recién** otorgados en esta llamada (título, descripción, icono, `achieved_at`). Es lo que dispara la animación en el cliente.
- `GET /api/achievements` (auth requerida): devuelve el catálogo completo con el estado de cada logro para el usuario — `achieved_at` si ya está conseguido, o el valor actual del agregado relevante si está pendiente (para pintar "320/500 km" en "Mis logros"). No otorga nada, solo lee.
Ambos reutilizan la misma consulta de agregados (Decisión 4) — un único lugar donde vive "cómo se calcula el progreso de un usuario".
**Alternativa descartada**: un único endpoint `GET /api/achievements` que también otorgue como efecto secundario de cualquier lectura. Mezclaría una operación de escritura dentro de un verbo `GET` (no idempotente en el sentido HTTP, complica cachear o repetir la llamada con seguridad) — se prefiere separar la escritura (`POST /check`, disparada solo tras sync) de la lectura (`GET`, disparada al abrir "Mis logros").

### 4. Una única query de agregados con `FILTER`, sin nueva query por tipo de requisito
```sql
SELECT
  COALESCE(SUM(total_distance), 0)                                                    AS total_km,
  COUNT(*)                                                                            AS route_count,
  COALESCE(MAX(duration), 0)                                                          AS longest_route_seconds,
  COALESCE(SUM(total_distance) FILTER (
    WHERE safe_parse_timestamptz(created_at) >= date_trunc('month', now())
  ), 0)                                                                                AS month_km
FROM routes
WHERE user_id = $1
```
Un solo `SELECT` cubre los 4 tipos de requisito iniciales; añadir un tipo nuevo que se apoye en los mismos agregados no exige tocar esta query. `created_at` es `TEXT` libre sin validar (ver Context) — en vez de un `::timestamptz` directo (que abortaría toda la consulta si una sola fila no es parseable), se usa `safe_parse_timestamptz()` (función `plpgsql` nueva en la propia migración `0009`, con `EXCEPTION WHEN others THEN RETURN NULL`) para aislar el fallo a esa fila: devuelve `NULL`, la comparación de esa fila en el `FILTER` se evalúa a falso, y esa ruta simplemente no cuenta para `month_km` — el resto de agregados del usuario (`total_km`, `route_count`, `longest_route_seconds`, que no dependen de `created_at`) no se ven afectados en absoluto.

### 5. "Mes natural" = mes natural en la zona horaria del servidor de BBDD (no por usuario)
`date_trunc('month', now())` usa la zona horaria de la sesión de Postgres, que en este proyecto no fija ninguna zona explícita (por tanto UTC por defecto del contenedor `postgres:16-trixie`). No se resuelve la zona horaria del usuario — un usuario cerca de la medianoche en su zona local podría ver el corte de mes desplazado unas horas respecto a su reloj. Aceptado explícitamente: ningún otro dato de la app (fechas de rutas, notas) resuelve zona horaria por usuario tampoco, sería inconsistente añadirla solo aquí.

### 6. Catálogo inicial sembrado por la propia migración (datos, no código)
La migración `0009_create_achievements.sql` crea las tablas **y** inserta las 10 filas del catálogo inicial (proposal.md → What Changes) como `INSERT` normales. Coherente con "logros basados en datos": el propio mecanismo de añadir un logro nuevo en producción es escribir una fila (vía una migración futura o, si se decide más adelante, un panel de admin fuera de alcance de este cambio).

### 7. Comprobación disparada por el cliente tras `uploadRouteToCloud()`, sin infraestructura de "escucha" nueva
Se añade una llamada a `POST /api/achievements/check` inmediatamente después de que `uploadRouteToCloud()` (`route-detail-cloud.service.ts`) resuelva con éxito — tanto desde el flujo de subida manual (`route-detail-cloud-upload.ts`) como desde el auto-resync (`route-detail-sync-triggers.ts`). Fire-and-forget respecto al flujo de subida (no bloquea ni puede hacer fallar la subida ya confirmada, ver spec "Fallo al comprobar logros no bloquea la sincronización").
**Alternativas descartadas**: (a) WebSocket/SSE desde el backend empujando logros nuevos en tiempo real — infraestructura nueva no justificada, la app no tiene hoy ningún canal persistente cliente-servidor; (b) polling periódico en el cliente — gasta batería/datos sin necesidad, el evento relevante (una ruta se sincronizó) ya es observable directamente; (c) job cron en el backend — introduce el retraso que la propuesta original quería evitar (animación al momento, no en la siguiente apertura de la app). La opción elegida es la única de las cuatro sin dependencia ni infraestructura nueva.

### 8. Overlay de desbloqueo nuevo en `shared/feedback/`, con cola en memoria
`achievement-unlock-overlay.element.ts` junto a `toast.ts`/`confirm-dialog.element.ts` — mismo dominio compartido, mismo motivo (usado desde múltiples flujos: subida manual y auto-resync, ambos fuera de `src/achievements/`). Una función `enqueueAchievementUnlock(achievement)` mantiene una cola en memoria (array module-level, sin persistencia) y muestra una animación a la vez, avanzando a la siguiente al cerrarse — igual de simple que necesita el escenario "en cola, uno tras otro" de la spec, sin añadir una librería de gestión de colas.
**Sin dependencia nueva**: la animación se implementa con CSS (transiciones/keyframes ya usados en el proyecto vía tokens), respetando `prefers-reduced-motion` como ya hacen otros componentes.

## Risks / Trade-offs

- **[Riesgo] `created_at` es `TEXT` sin validar; un valor no parseable podría romper el cálculo de agregados** → Mitigación implementada en la propia query (Decisión 4): `safe_parse_timestamptz()` aísla el fallo a nivel de fila (esa ruta no cuenta para `month_km`, el resto de agregados no se ve afectado), sin necesitar capturar ningún error en el handler Go. Test dedicado en `dbtest` con una fila `created_at` deliberadamente inválida, comprobando que `total_km`/`route_count`/`longest_route_seconds` de esa ruta sí se contabilizan y solo `month_km` la excluye. No se cambia el tipo de columna de `routes.created_at` en este cambio (fuera de alcance, afectaría a `favoritos-rutas`/`compartir-ruta`/etc. que ya la usan como texto).
- **[Riesgo] Añadir una llamada a `POST /api/achievements/check` tras cada sync incrementa la carga por cada subida/resubida de ruta** → Mitigación: la query de agregados es una sola consulta indexada por `idx_routes_user_id` ya existente; el volumen real (subidas manuales + resyncs tras editar) es bajo comparado con otras rutas ya autenticadas del mismo endpoint.
- **[Riesgo, `src/shared/`] El overlay nuevo y el hook en `route-detail-cloud.service.ts` tocan un fichero ya consumido por múltiples dominios (`route-detail`, futura pantalla `achievements`)** → Mitigación: el hook se añade como una llamada adicional al final de `uploadRouteToCloud()` sin cambiar su firma ni su contrato de error actual (sigue lanzando/resolviendo igual); tests existentes de `route-detail-cloud.service.spec.ts` no deberían necesitar cambios, solo tests nuevos para la llamada añadida.
- **[Trade-off] Sin soporte de zona horaria por usuario para "mes natural" (Decisión 5)** → Aceptado explícitamente, coherente con el resto de la app.

## Migration Plan

- Migración `apps/api/internal/migrate/migrations/0009_create_achievements.sql`: `CREATE TABLE achievements`, `CREATE TABLE user_achievements`, `INSERT` del catálogo inicial (10 filas). Aplicada por el runner propio de `internal/migrate` (embed.FS), igual que las 8 anteriores — sin Flyway/Liquibase, sin pasos manuales.
- Sin migración de datos existentes: no hay logros previos que migrar, tabla nueva vacía de otorgados.
- Rollback: si hiciera falta revertir, `DROP TABLE user_achievements, achievements` — el runner actual no soporta `down` automático (mismo criterio que las migraciones anteriores de este proyecto), se documentaría como paso manual si llegara a necesitarse.
- Sin ADR nueva: ninguna decisión de este diseño introduce una dependencia nueva, un patrón arquitectónico nuevo o una reversión de una decisión previa — todas reutilizan patrones ya establecidos (`routesharing`, `route-sharing`, `toast.ts`), mismo criterio que `favoritos-rutas`/`compartir-ruta`.
