## Context

Ver `proposal.md - Why` para la motivación. Estado actual relevante:

- **Local**: `apps/mobile/src/shared/models/route.types.ts` ya define `Route`/`RoutePoint`/`RouteStop` (con `origin: 'local' | 'remote'` ya declarado en el tipo pero sin usar en ningún sitio todavía — es el punto de partida natural para este cambio). `IRouteRepository` (SQLite) expone `getAll`/`getById`/`getPointsByRouteId`/`getStopsByRouteId`.
- **Backend**: `apps/api/internal/auth/` ya tiene `RequireAuth` (JWT Bearer) y `PostgresUserStore`. `internal/stoptypes/` es el precedente más cercano de un dominio de solo-lectura con su propio store Postgres — este cambio sigue el mismo patrón pero con escritura.
- **CORS**: gap real ya encontrado y corregido en `pantallas-auth-mobile` (`httpmw.PublicCORS` + ruta `OPTIONS` explícita) — los endpoints nuevos de este cambio deben llevarlo desde el primer commit, no descubrirlo tarde otra vez.
- **Fotos**: explícitamente fuera de alcance (ver proposal.md); no se toca `photo.repository.ts` ni `internal/` de fotos (no existe todavía en `apps/api`).

## Goals / Non-Goals

**Goals:**
- Persistir una ruta completa (metadatos + puntos + paradas, sin fotos) en la cuenta del usuario autenticado.
- Listado combinado local+nube sin duplicar entradas, con estado visual por ruta.
- Ver el detalle completo de una ruta que solo existe en el servidor.
- Aislamiento estricto por cuenta: ninguna ruta de otro usuario es alcanzable, ni siquiera adivinando un id.

**Non-Goals:**
- Subida/sincronización de fotos — cambio futuro (ADR-034 ya lo anticipa).
- Descargar/cachear en SQLite una ruta que solo existe en la nube — el detalle se lee del servidor cada vez; "importar a local" es una feature aparte.
- Borrar una ruta de la nube desde la app — no hay requisito de negocio para ello todavía; se puede añadir después sin romper este diseño (mismo endpoint de recurso, verbo nuevo).
- Resolución de conflictos entre ediciones concurrentes desde varios dispositivos — el upsert es "gana el último subido", aceptable para un usuario único con un dispositivo principal.
- Rate limiting al nivel de los endpoints de auth (login/registro) — subir una ruta no revela existencia de cuentas ni es un vector de enumeración; el único control es un límite de tamaño por request (ver Decisión 4).

## Decisions

**1. Identidad de la ruta: el mismo `id` (UUID) que ya genera el cliente, también como clave primaria en el servidor.**
El cliente ya genera un UUID al crear una ruta (`CreateRoute.id?`, usado hoy para asociar fotos capturadas en directo). Reutilizarlo como PK en Postgres permite un upsert directo por id (`INSERT ... ON CONFLICT (id) DO UPDATE`) sin tabla de mapeo `local_id ↔ server_id`. Alternativa descartada: id autogenerado por el servidor + mapeo aparte — añade una tabla y un round-trip extra (crear → guardar el id devuelto) sin beneficio real, ya que el UUID del cliente ya es único de sobra.

**2. Esquema Postgres: tres tablas nuevas, mismo shape que el SQLite local.**
`routes` (metadatos: id, user_id, created_at, duration, total_distance, avg_speed, status, name, notes), `route_points` (id, route_id, timestamp, lat, lng, alt, speed) y `route_stops` (id, route_id, start_time, end_time, lat, lng, type, stop_category_id → FK a `stop_types`, ya existente). Todas con `user_id`/`route_id` indexado. Migración nueva vía el runner ya existente (`internal/migrate`, `.sql` + `schema_migrations`), se aplica sola al arrancar el binario — mismo mecanismo que las migraciones `0001`-`0004`, sin paso manual por SSH.

**3. Tres endpoints nuevos en `internal/routes/`, todos tras `RequireAuth`:**
- `POST /api/routes` — upsert de una ruta completa (metadatos + `points[]` + `stops[]`) del usuario autenticado. Idempotente por `id`.
- `GET /api/routes` — lista las rutas del usuario autenticado, solo campos de resumen (sin puntos) para que el listado cargue rápido.
- `GET /api/routes/{id}` — detalle completo (puntos + paradas) de una ruta del usuario autenticado.
Los tres derivan el `user_id` del token JWT, nunca de un parámetro de la petición — el `WHERE user_id = ?` va en cada query, y `GET /api/routes/{id}` responde `404` (no `403`) si la ruta pertenece a otro usuario o no existe, para no distinguir ambos casos.

**4. Límite de tamaño en la subida.**
`POST /api/routes` rechaza (400) una ruta cuyo `points[]` supere un límite fijo (a definir en implementación, orden de magnitud: decenas de miles de puntos — un trayecto de un día entero a 1 punto/seg). Evita payloads desproporcionados sin necesitar un límite de rate limiting dedicado. Ver Open Questions para el valor exacto.

**5. CORS desde el primer commit.**
Los tres endpoints llevan `.With(httpmw.PublicCORS)` + su ruta `OPTIONS` en `cmd/api/main.go`, igual que los endpoints de auth tras el fix de `pantallas-auth-mobile` — evita repetir el mismo gap descubierto tarde la vez anterior.

**6. Frontend: nuevo servicio de fusión, sin tocar `IRouteRepository`.**
`route.repository.ts` (contrato SQLite/memoria) no cambia — sigue siendo la fuente de verdad de lo local. Un `route-list.service.ts` nuevo combina `repository.getAll()` (local) con la respuesta de `GET /api/routes` (si hay sesión), casando por `id` para no duplicar filas, y calculando el estado (`local` / `synced` / `cloud-only`) por ruta. `route-detail` gana una rama: si el id no existe en el repositorio local, sus datos se piden a `GET /api/routes/{id}` en vez de al repositorio SQLite — mismo componente de mapa/timeline, origen de datos distinto.

**7. UI del detalle: icono junto al nombre, no un botón de ancho completo.** Sustituye al botón "Subir a la nube" original — un icono pequeño junto al `<h1>` del título: nube-subir (ruta local sin subir, pulsable), nube-check (ya sincronizada, pulsable para forzar una re-subida manual) o nada (ruta exclusiva de la nube, no hay nada que subir). Decisión tomada tras verificar en dispositivo real que un botón de ancho completo por cada ruta local resultaba demasiado prominente para una acción secundaria.

**8. Detección de "¿esta ruta ya está sincronizada?" en `route-detail`: una consulta a `GET /api/routes` al cargar, no un campo persistido.** `route-detail` no tiene forma directa de saberlo por sí solo (`IRouteRepository` no guarda estado de sincronización) — con sesión activa y una ruta que existe localmente, se consulta `fetchCloudRoutes` y se comprueba si el id está en la respuesta. Alternativa descartada: pasar el estado ya calculado por `route-list` (que sí lo tiene, del merge) al navegar al detalle — se descarta porque el detalle puede abrirse en otros contextos futuros sin pasar por el listado, y porque el estado del propio listado podría estar desactualizado (p. ej. si se subió la ruta y se volvió sin refrescar la lista). Coste aceptado: una llamada de red adicional por apertura de detalle, solo con sesión activa.

**9. Indicador de estado en `route-list`: insignia superpuesta en la esquina de la miniatura, solo icono, sin texto — mismos iconos que en el detalle.** Sustituye a `SYNC_BADGE_LABEL` (texto "Solo local"/"Sincronizada"/"En la nube"). Decisión revisada tras dos iteraciones visuales verificadas en dispositivo real: primero se probó como chip en la fila de distancia/duración, luego junto al botón de eliminar (columna de acciones) — ambas dejaban el icono visualmente descentrado respecto al resto de la tarjeta (confirmado por medición real de `getBoundingClientRect()` vía Chrome DevTools Protocol contra el WebView, no solo a ojo). La insignia sobre la miniatura (mismo patrón que el indicador de "sincronizado" de apps de fotos) evita el problema de raíz: no compite por espacio vertical con ningún otro elemento de la fila. El botón de eliminar vuelve a ir solo, como antes de este cambio.

**10. Re-subida automática silenciosa: solo si la ruta ya estaba sincronizada, nunca sube una ruta puramente local.** Al guardar una nota o al añadir/borrar una foto en una ruta con `isSynced === true`, se llama a `uploadRouteToCloud` en segundo plano — sin toast de éxito (para no ser ruidoso en una acción secundaria a la que el usuario no ha prestado atención explícita), pero con un aviso discreto si falla (p. ej. sin conexión), sin revertir el cambio local ya guardado. Una ruta local sin subir nunca se sube por este mecanismo — solo el icono de subida manual lo hace la primera vez.
**Fotos, pendiente explícito para el futuro blob storage (ADR-034)**: esta re-subida automática solo cubre metadatos/puntos/paradas — la foto en sí nunca se sube (fuera de alcance, ver Non-Goals). Cuando exista subida de fotos, este mismo punto de enganche (`handleAddPhoto`/`handleDeletePhoto` en `route-detail.element.ts`) es donde debe añadirse la subida de la foto — dejado como comentario `// TODO` explícito en el código, no solo en este documento.

## Risks / Trade-offs

- **[Riesgo] Payloads grandes por ruta larga** → mitigado por el límite de tamaño (Decisión 4); si en el futuro hace falta soportar rutas más largas, subir el límite es un cambio de una constante, no de diseño.
- **[Riesgo] Detalle de una ruta solo-en-la-nube requiere red cada vez que se abre** → aceptado para este cambio (Non-Goal: sin caché local); si la latencia resulta molesta en uso real, cachear es una mejora incremental sin romper la API.
- **[Trade-off] Upsert sin resolución de conflictos** → con un único dispositivo activo por cuenta (caso de uso actual) no hay conflicto real; si en el futuro se usa la misma cuenta desde dos móviles a la vez, "gana el último subido" podría pisar cambios — aceptado explícitamente, documentado aquí para no sorprender más adelante.

## Migration Plan

Migración Postgres nueva (`000X_create_routes.sql`), aplicada sola por el runner existente al desplegar — mismo procedimiento ya usado en `confirmacion-email-usuarios`/`reset-contrasena` (redeploy manual documentado en ADR-036, sin automatizar por decisión ya tomada). Sin datos que migrar (tablas nuevas, vacías). Rollback: si hiciera falta revertir, basta con volver a la imagen Docker anterior — la migración nueva no modifica ninguna tabla existente, así que no hay `down` que ejecutar para dejar el resto del esquema intacto.

## Open Questions

- Valor exacto del límite de puntos por ruta (Decisión 4) — se fija en `tasks.md`/implementación con un número concreto y su test correspondiente; no cambia el escenario de la spec ("supera el límite soportado"), así que no bloquea el resto del diseño.
