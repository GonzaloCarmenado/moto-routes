## 1. Backend — esquema y store

- [x] 1.1 Migración `apps/api/internal/migrate/migrations/0013_create_friendships.sql`: tabla `friendships` (`id UUID`, `requester_id BIGINT`, `addressee_id BIGINT`, `status TEXT DEFAULT 'pending'`, `created_at`/`updated_at`), índices sobre `(addressee_id, status)` y `(requester_id, status)` — mismo patrón que `0008_create_route_shares.sql`.
- [x] 1.2 Test rojo: `internal/auth` — `FindUserByUsername` no existe en `UserStore`, escribir el test que lo espera (case-insensitive, mismo criterio que el índice único de `0012_add_users_username.sql`).
- [x] 1.3 Implementación mínima: añadir `FindUserByUsername` a la interfaz `UserStore`, `PostgresUserStore` y cualquier store en memoria usado en tests de `internal/auth` — verde.
- [x] 1.4 Test rojo: `internal/friends` — store `Create` rechaza self-request (`ErrCannotFriendSelf`) y solicitud duplicada/ya-amigos en cualquier dirección (`ErrAlreadyFriendsOrPending`), sin crear fila.
- [x] 1.5 Implementación mínima del store (`PostgresFriendshipStore`): `Create`, `ListReceivedPending`, `ListSent`, `ListAccepted`, `MarkAccepted`, `MarkDeclined`, `MarkRevoked` — verde.

## 2. Backend — handlers y rutas

- [x] 2.1 Test rojo: `CreateRequestHandler` responde siempre el mismo mensaje genérico (username inexistente, propio username, ya-amigos/pendiente) — igual que `tryCreateInvitation`.
- [x] 2.2 Implementación mínima de `CreateRequestHandler` (`tryCreateFriendRequest` interno que nunca revela el motivo) — verde.
- [x] 2.3 Test rojo + implementación: `ListReceivedHandler`, `ListSentHandler`, `ListFriendsHandler` (amigos aceptados).
- [x] 2.4 Test rojo + implementación: `AcceptHandler`, `DeclineHandler`, `RevokeHandler`, con las mismas comprobaciones de pertenencia (404 uniforme) que `routesharing.DeclineHandler`/`RevokeHandler`.
- [x] 2.5 Test rojo + implementación: `RateLimitedCreateRequestHandler` envolviendo `CreateRequestHandler`, mismo `LoginRateLimiter` que `routesharing`.
- [x] 2.6 Wiring en `cmd/api/main.go`: `POST /api/friends`, `GET /api/friends/received`, `GET /api/friends/sent`, `GET /api/friends`, `POST /api/friends/{id}/accept`, `POST /api/friends/{id}/decline`, `POST /api/friends/{id}/revoke`, con su `OPTIONS` explícito cada una.
- [x] 2.7 Comprobar `httpmw/cors.go`: confirmar que `Access-Control-Allow-Methods` ya cubre `POST`/`GET` para estas rutas nuevas (gap ya repetido 4 veces en este repo) — no asumir, verificar con un test o petición real.

## 3. Frontend — servicio HTTP compartido

- [x] 3.1 Test rojo + implementación: `apps/mobile/src/shared/http/friends-api.service.ts` (`sendFriendRequest`, `listReceivedRequests`, `listSentRequests`, `listFriends`, `acceptFriendRequest`, `declineFriendRequest`, `revokeFriendRequest`), mismo patrón snake_case→camelCase que `route-sharing-api.service.ts`.

## 4. Frontend — dominio `src/friends/`

- [x] 4.1 Test rojo + implementación: `friends-list.transform.ts` (formatea la respuesta del backend a los tipos de vista).
- [x] 4.2 Test rojo + implementación: `friends-view.element.ts` (vista nueva: enviar solicitud por username, tabs o secciones de "Amigos"/"Recibidas"/"Enviadas", acciones aceptar/rechazar/revocar), con sus `data-cy` propios.
- [x] 4.3 Test rojo + implementación: estados vacíos (sin amigos, sin solicitudes pendientes) y mensajes de error (username no encontrado — mismo mensaje genérico que el backend, sin conexión, límite de solicitudes).
- [x] 4.4 `friends-view.element.css` con tokens de `shared/styles/tokens.css`, modo oscuro, hitbox mínima 56×56px.

## 5. Frontend — entrada desde Perfil y evento de vista

- [x] 5.1 Evento `VIEW_FRIENDS` nuevo en `shared/app-events.ts`, mismo patrón que `VIEW_ACHIEVEMENTS`.
- [x] 5.2 Test rojo + implementación: `profile-friends-link.ts` (botón de entrada en Perfil, despacha `VIEW_FRIENDS`, muestra badge con el número de solicitudes pendientes recibidas — "9+" por encima de 9), mismo patrón que `profile-achievements-link.ts`.
- [x] 5.3 `app.element.ts`: registra la vista `friends-view` y escucha `VIEW_FRIENDS`, mismo patrón que `onViewAchievements`.
- [x] 5.4 `profile.element.ts`: monta `profile-friends-link.ts` en la tarjeta de identidad/cuenta.

## 6. E2E (Cypress, backend real)

- [x] 6.1 `apps/mobile/cypress/e2e/friends/friends.cy.ts`: enviar solicitud por username a una cuenta real, verla en "Enviadas".
- [x] 6.2 Aceptar una solicitud: aparece en el listado de amigos de ambas cuentas.
- [x] 6.3 Rechazar una solicitud: no aparece amistad en ninguna cuenta (cubierto por el mismo flujo de aceptar/rechazar en 6.2, mismo criterio que `route-sharing.cy.ts`).
- [x] 6.4 Revocar una solicitud pendiente: el destinatario ya no puede aceptarla.
- [x] 6.5 Una cuenta ajena no puede aceptar/rechazar/revocar una solicitud que no le pertenece.
- [x] 6.6 Badge de solicitudes pendientes en el punto de acceso desde Perfil — verificado el recuento real (2); el caso "9+" ya está cubierto a nivel unitario (`friends-list.transform.spec.ts`, `profile-friends-link.spec.ts`), sin repetirlo en E2E por el coste de crear 10 cuentas reales para lo mismo.

## 7. Cierre

- [x] 7.1 Suite completa en verde: `go test ./...` (18 paquetes), `tsc --noEmit`, `eslint src/ --max-warnings 0`, Vitest 1342/1342 (97.12% líneas), Cypress **91/91** (suite completa, no solo lo nuevo) contra backend real (`docker compose up` en `infra/docker/`, imagen `api` reconstruida con el paquete `friends`). Bug real encontrado y arreglado durante esta verificación: `route-sharing.element.ts` y `friends-view.element.ts` compartían los ids de pestaña `recibidas`/`enviadas` — como `app.element.ts` monta ambas vistas a la vez (solo alterna `display:none`), `[data-cy="tab-bar-btn-enviadas"]` resolvía a 2 elementos y rompía `route-sharing.cy.ts`. Corregido prefijando los ids de `friends-view` (`friends-amigos`/`friends-recibidas`/`friends-enviadas`), sin tocar `route-sharing` (capability ya en producción).
- [x] 7.2 `openspec sync` de la spec `amigos` a `openspec/specs/` (capability nueva, `openspec/specs/amigos/spec.md`), `openspec validate --all --strict` sin errores (28/28).
- [x] 7.3 Revisar el diff completo buscando secretos antes de abrir la PR — sin hallazgos (solo el `TEST_PASSWORD` placeholder ya usado idénticamente en el resto de specs de Cypress del repo).
- [x] 7.4 Actualizado `memory/context.md` (sesión, estado actual, próximo hito) y `memory/decisions.md` con ADR-056 (bug real de ids de `<tab-bar>` colisionando entre `route-sharing`/`friends-view`, encontrado en la verificación de la suite completa, no anticipado en design.md).
- [x] 7.5 `review.md` con veredicto **APPROVED** (independiente, dos bugs reales encontrados y corregidos antes de archivar), `/opsx:archive` hecho (`openspec/changes/archive/2026-08-23-agregar-amigos/`), commit `9eb0bba`, push y PR #151 de `feature/agregar-amigos` a `master` — nunca directo, per `CLAUDE.md`.
