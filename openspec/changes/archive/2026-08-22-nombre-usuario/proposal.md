## Why

El proyecto va a añadir una funcionalidad de "amigos" (invitar/aceptar) que, a futuro, debe poder identificar cuentas por un nombre de usuario público en vez de por su email — el email es sensible (nunca se revela si existe una cuenta, ver `user-auth`) y no es apto para búsqueda/invitación pública. Hoy `users` no tiene ningún campo de username: el "Nombre" que ya existe en Perfil (`apps/mobile/src/profile/`) es puramente local (SQLite del dispositivo, nunca sincronizado), no una identidad de cuenta en el backend. Este cambio añade esa pieza de infraestructura de forma aislada, antes de la spec de amigos, para que esta última la consuma sin tener que resolver también el modelo de identidad.

## What Changes

- `users` gana un campo `username` único (backend), obligatorio: se pide en el registro para cuentas nuevas.
- Las cuentas ya existentes sin username quedan bloqueadas en un flujo dedicado para fijarlo la próxima vez que abran la app con sesión activa — no pueden seguir usando el resto de la app hasta hacerlo (decisión ya tomada con el usuario).
- El username se puede editar más adelante desde Perfil (no es de una sola vez) — mismo criterio: siempre único, nunca vacío una vez fijado.
- **BREAKING** (solo de datos, no de API pública): `users.username` empieza `NULL` para todas las cuentas existentes (no hay ningún valor razonable que rellenar automáticamente) — el bloqueo en frontend es lo que garantiza que, en la práctica, ninguna cuenta activa se queda sin username indefinidamente. Ver design.md, Decisión 1.

## Capabilities

### Modified Capabilities
- `user-auth`: el registro pasa a exigir también un username único; `GET /api/auth/me` lo expone; se añade la capacidad de fijarlo (cuentas existentes bloqueadas) y editarlo después.

## Impact

- **Backend**: `apps/api/internal/auth/` — migración nueva (`users.username`, nullable + índice único), `user.go` (`StoredUser.Username`, `ErrUsernameTaken`), `postgres_store.go` (`CreateUser` exige username, nuevo método de actualización), `register.go` (`registerRequest`/`registerResponse` ganan `username`, validación de formato), `me.go` (`meResponse` gana `username`), endpoint nuevo `PATCH /api/auth/username` (fijar/editar, con rate limiting igual que el resto de endpoints de auth).
- **Frontend**: `apps/mobile/src/auth/` (`auth-register-dialog.element.ts` gana el campo, `auth-api.service.ts` — `CurrentUser`/`fetchCurrentUser` mapean `username`), flujo nuevo de bloqueo para cuentas existentes sin username (punto de inserción a decidir en design.md — hoy no existe ningún gate global de sesión en la app), y una pieza nueva en Perfil para editarlo después (mismo patrón que `profile-edit-dialog.element.ts`, pero contra el backend en vez de SQLite local).
- **Fuera de alcance de este cambio**: la spec de "agregar amigos" en sí (invitaciones, aceptar, listado) — se propondrá después, consumiendo este username.
