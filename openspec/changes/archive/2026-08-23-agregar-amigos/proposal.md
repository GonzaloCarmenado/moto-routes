## Why

Desde `nombre-usuario` toda cuenta tiene un `username` único y obligatorio, pensado explícitamente como el identificador público con el que un usuario se presenta a otros (ver memory/context.md, sesión 2026-08-21 (2): "username obligatorio como infraestructura previa a `agregar-amigos`"). Hoy esa identidad no sirve para nada social: la única forma de relacionarse con otra cuenta es `compartir-rutas`, que exige conocer el email exacto de la otra persona cada vez, sin dejar ningún vínculo persistente. No existe ninguna lista de contactos ni forma de encontrar a alguien solo por su username.

## What Changes

- Nueva capability `amigos`: solicitud de amistad identificando al destinatario por su `username` (no por email — email ya lo cubre `compartir-rutas` para un caso distinto; usar el username aquí es justo el propósito por el que se hizo obligatorio y único), aceptar, rechazar, listado de amigos aceptados, y revocar una solicitud enviada mientras siga pendiente.
- Mismo patrón de invitación ya validado en `compartir-rutas`/`internal/routesharing`: respuesta genérica idéntica exista o no el username (sin enumeración de cuentas), rate limiting de solicitudes repetidas, badge con el número de solicitudes pendientes recibidas.
- Nuevo dominio de frontend `src/friends/` (paralelo a `src/achievements/`, no anidado bajo `profile/`) con un punto de entrada nuevo desde Perfil (`profile-friends-link.ts`, mismo patrón que `profile-achievements-link.ts`), mostrando el badge de pendientes.
- Nuevo paquete de backend `internal/friends` (Go), reutilizando `auth.UserStore`/`apihttp` como hace `internal/routesharing`.

## Capabilities

### New Capabilities
- `amigos`: solicitudes de amistad por username (enviar, aceptar, rechazar, revocar), y listado de amigos ya aceptados.

### Modified Capabilities
(ninguna — `compartir-rutas` y `notificaciones-push` no cambian de comportamiento; ver Non-Goals en design.md sobre por qué las notificaciones push quedan fuera de este cambio)

## Impact

- **Backend nuevo**: `apps/api/internal/friends/` (store + handler + tests), migración nueva `apps/api/internal/migrate/migrations/0013_create_friendships.sql`. Wiring de rutas nuevas en `apps/api/cmd/api/main.go` (junto a las de `routesharing`), y `httpmw/cors.go` si hace falta un método nuevo (ver el gap de `PATCH` ya documentado 4 veces ahí — comprobar antes de asumir que ya está cubierto).
- **Backend modificado**: `internal/auth.UserStore` gana `FindUserByUsername` (no existe todavía, confirmado — ver design.md D1/Risks).
- **Backend reutilizado sin cambios**: `internal/apihttp`, `internal/auth.LoginRateLimiter`.
- **Frontend nuevo**: `apps/mobile/src/friends/` (dominio nuevo, estructura `.element`/`.service`/`.transform` como el resto del repo), `apps/mobile/src/shared/http/friends-api.service.ts` (mismo patrón que `route-sharing-api.service.ts`), `apps/mobile/src/profile/profile-friends-link.ts`.
- **Frontend modificado**: `apps/mobile/src/app/app.element.ts` (nueva vista + evento `VIEW_FRIENDS` en `shared/app-events.ts`, mismo patrón que `VIEW_ACHIEVEMENTS`), `apps/mobile/src/profile/profile.element.ts` (monta el nuevo link de entrada).
- **E2E nuevo**: `apps/mobile/cypress/e2e/friends/friends.cy.ts` contra backend real, mismo criterio que `route-sharing.cy.ts`.
- **Sin cambios**: `internal/routesharing`, `internal/notifications`, esquema de `users` (el `username` ya existe desde `nombre-usuario`).
