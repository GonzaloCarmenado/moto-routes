## Why

Hoy la sesión de la app dura un único JWT sin estado de 24h (`apps/api/cmd/api/main.go:30`, `tokenTTL`), sin ningún mecanismo de renovación: al expirar, el siguiente `GET /api/auth/me` devuelve 401, el cliente borra la sesión local (`auth-section.service.ts`) y el usuario tiene que volver a escribir su contraseña. Esto obliga a reintroducir la contraseña cada día de uso real, algo que ninguna app comparable (Instagram, WhatsApp, etc.) exige — y además el JWT actual, al ser completamente stateless, no se puede revocar antes de que expire por sí solo si el dispositivo se pierde o se cierra sesión (limitación ya documentada explícitamente en ADR-036 al descartar invalidación de sesiones en el reset de contraseña).

## What Changes

- Nuevo **refresh token** de vida larga (30-90 días), emitido junto al access token en el login (el registro no emite sesión hoy, exige verificar el email y loguearse aparte — sin cambios ahí), guardado server-side en una tabla nueva (revocable) y en el cliente junto a la sesión existente.
- El **access token** (JWT actual) pasa de 24h a una vida corta (15-60 min) — se convierte en un token de corta duración pensado para renovarse solo, no para que el usuario "note" su expiración.
- Nuevo endpoint `POST /api/auth/refresh`: intercambia un refresh token válido por un access token nuevo (y, con rotación, un refresh token nuevo), sin pedir contraseña.
- El cliente intenta renovar el access token de forma silenciosa al abrir la app y ante cualquier 401 con refresh token disponible, antes de forzar el logout — el usuario solo ve la pantalla de login si el refresh token también expiró o fue revocado.
- Revocación explícita del refresh token al cerrar sesión ("Cerrar sesión" ya no deja una sesión larga viva de fondo).
- **BREAKING**: el cambio de TTL del access token de 24h a minutos es una ruptura de compatibilidad para cualquier sesión ya emitida antes del despliegue — quedará inválida tras el corte y esos usuarios necesitarán volver a iniciar sesión una vez (con contraseña), momento en el que ya recibirán el refresh token nuevo.

## Capabilities

### Modified Capabilities
- `user-auth`: la sesión deja de ser un único JWT de 24h sin renovación — se añade el ciclo de vida completo access+refresh token (emisión, renovación silenciosa, revocación al logout).

## Impact

- **Backend** (`apps/api/internal/auth/`): `token.go` (TTL del access token), `main.go` (constante `tokenTTL`), nuevo `refresh_token.go`/handler, nueva migración (tabla `refresh_tokens`), nuevo endpoint en `main.go` junto al resto de rutas de auth, tests nuevos calcados del patrón ya usado en `login_test.go`/`username_test.go`.
- **Frontend** (`apps/mobile/src/`): `shared/models/session.types.ts` (añade refresh token + `expiresAt`), `shared/repositories/sqlite-session.repository.ts`/`memory-session.repository.ts`, `auth/auth-api.service.ts` (nueva llamada `refreshSession`), `auth/auth-section.service.ts` (renovación silenciosa en vez de logout directo ante 401), posible nuevo punto de entrada en `app.element.ts` para intentar renovar al arrancar la app.
- **Specs**: `openspec/specs/user-auth/spec.md` gana requirements nuevos sobre emisión, renovación silenciosa y revocación del refresh token; el requirement de login se amplía para incluir el refresh token en la respuesta. El rechazo de access tokens inválidos/expirados (401) no cambia — la distinción entre "renovable" y "hay que volver a loguearse" la hace el cliente reintentando con el refresh token, no la API.
- **Sin cambio** en `mobile-auth-screens` (la UI de login no cambia, solo deja de aparecer tan a menudo).
