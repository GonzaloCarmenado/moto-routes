## Context

`compartir-rutas` (`internal/routesharing`) ya resuelve, para un caso distinto, el mismo problema de fondo — invitación asíncrona entre dos cuentas con respuesta genérica, rate limiting, y aceptar/rechazar/revocar. `amigos` reutiliza esa forma exacta en vez de inventar una nueva. La diferencia real: el identificador es el `username` (no el email, que `compartir-rutas` ya usa para su propio caso) y aceptar no dispara ningún efecto secundario de datos (no hay nada que clonar) — solo la propia relación de amistad.

`auth.UserStore` no tiene hoy `FindUserByUsername` (confirmado por grep, solo existe `FindUserByEmail`) — necesario añadirlo pese a que el índice único case-insensitive sobre `username` ya existe desde `0012_add_users_username.sql`.

## Goals / Non-Goals

**Goals:**
- Solicitud, aceptación, rechazo, revocación y listado de amistades, con el mismo nivel de protección contra enumeración de cuentas que `compartir-rutas`.
- Reutilizar el patrón de store/handler/rate-limiter de `internal/routesharing` sin reinventar la forma.

**Non-Goals:**
- **Notificaciones push al recibir una solicitud**: fuera de este cambio. `compartir-rutas` tampoco las tenía al cerrarse — se añadieron después en `notificaciones-push-fcm`, un cambio dedicado. Mismo criterio aquí: primero la funcionalidad in-app, push como posible cambio futuro si el usuario lo pide.
- **Ver rutas o actividad de un amigo**: ningún vínculo entre `amigos` y `route-cloud-sync`/`compartir-rutas` en este cambio — la lista de amigos no habilita nada nuevo sobre rutas todavía.
- **Eliminar una amistad ya aceptada**: no pedido explícitamente; el listado es de solo lectura una vez aceptada. Candidato natural para un cambio futuro si hace falta.
- **Buscar cuentas por texto parcial o sugerencias**: la solicitud exige el username exacto, sin autocompletado ni búsqueda — mismo criterio que `compartir-rutas` exige el email exacto.

## Decisions

**D1 — Identificar por `username`, no por email.** `compartir-rutas` ya cubre el caso "conozco el email de alguien"; `amigos` cubre el caso social "conozco su username dentro de la app", que es justo el propósito por el que `username` se hizo obligatorio y único (`nombre-usuario`). Alternativa descartada: aceptar ambos (username o email) en el mismo campo — más superficie de ambigüedad (¿qué pasa si un username tiene forma de email?) sin ningún caso de uso reportado que lo pida.

**D2 — Un modelo de fila único (`friendships`), igual que `route_shares`.** Una fila por relación, con `status` (`pending`/`accepted`/`declined`/`revoked`) y `requester_id`/`addressee_id`. Al aceptar, la misma fila cambia de estado en vez de crear una segunda fila — el listado de amigos consulta `WHERE (requester_id = :me OR addressee_id = :me) AND status = 'accepted'`, sin necesitar dos filas espejo. Alternativa descartada: tabla separada `friendships` (solo aceptadas) + tabla `friend_requests` (solicitudes) — más tablas para el mismo ciclo de vida que `route_shares` ya resuelve con una.

**D3 — Solicitud cruzada o ya-amigos: mismo mensaje genérico, sin crear fila nueva.** Si ya existe una fila `pending` o `accepted` entre las dos cuentas (en cualquier dirección), `Create` no crea nada nuevo y el handler responde igual que un envío correcto — mismo criterio de "nunca revelar el motivo real" que ya usa `tryCreateInvitation` con `ErrCannotShareWithSelf`. Alternativa descartada: auto-aceptar si ya existe una solicitud cruzada pendiente (B ya le había escrito a A) — UX más mágica, pero comportamiento implícito no pedido; el usuario simplemente ve la solicitud ya pendiente de la otra persona en su bandeja y la acepta él mismo.

**D4 — Rutas HTTP y forma del handler, copia literal de `internal/routesharing`.** `POST /api/friends`, `GET /api/friends/received`, `GET /api/friends`, `POST /api/friends/{id}/accept`, `POST /api/friends/{id}/decline`, `POST /api/friends/{id}/revoke`, cada una con su `OPTIONS` explícito registrado aparte (el gap de CORS de `Access-Control-Allow-Methods` ya se ha repetido 4 veces en este repo por no enumerar un método nuevo — ver `httpmw/cors.go`, comprobar que `POST`/`GET` ya están antes de asumir que no hace falta tocarlo). `GET /api/friends` sirve el listado de amigos aceptados (no hay endpoint `sent` separado del genérico `GET /api/friends/sent`, mismo patrón que `route-shares/sent`).

**D5 — Frontend como dominio nuevo `src/friends/`, no dentro de `src/profile/`.** Mismo criterio ya usado para `src/achievements/`: una capability con su propia vista de app (registrada en `app.element.ts` vía un evento `VIEW_FRIENDS` nuevo en `shared/app-events.ts`) y un único punto de entrada discreto desde Perfil (`profile-friends-link.ts`, mismo patrón que `profile-achievements-link.ts`). Evita acoplar la lógica de amigos al ya extenso `profile.element.ts`.

## Risks / Trade-offs

- [`FindUserByUsername` nuevo en `auth.UserStore`] → interfaz ya implementada por `PostgresUserStore` y por el store en memoria de tests; añadir el método exige tocar ambas implementaciones y cualquier mock existente en tests de `internal/auth`. Revisar antes de implementar qué tests instancian `UserStore` a mano.
- [Mismo username puede tener mayúsculas distintas entre el input del usuario y el almacenado] → el índice de `0012_add_users_username.sql` ya es case-insensitive; `FindUserByUsername` debe usar la misma comparación (`LOWER(username) = LOWER($1)` o el operador ya usado en esa migración) para no crear un segundo criterio de búsqueda inconsistente con el de unicidad.
- [Tabla `friendships` nueva sin límite de amigos] → sin paginación en el listado inicial, aceptable para el volumen actual de usuarios de la app; revisar si se vuelve un problema real antes de añadir paginación especulativa.

## Open Questions

Ninguna — el resto de decisiones de diseño quedan resueltas arriba (D1-D5) o listadas como Non-Goals explícitos.
