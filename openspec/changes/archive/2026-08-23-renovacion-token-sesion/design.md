## Context

Ver proposal.md - Why para la motivación. Estado actual relevante para el "cómo":

- `apps/api/internal/auth/verification_token.go` ya tiene el patrón exacto que necesita un token opaco de un solo uso: `generateOneTimeToken()` (32 bytes de `crypto/rand`, `base64.RawURLEncoding`) + `hashOneTimeToken()` (`sha256` → hex), usado hoy para verificación de email y reset de contraseña. El valor sin hashear nunca se guarda en BBDD.
- `password_reset_tokens` (migración `0004`) es la plantilla de tabla más cercana a lo que necesita `refresh_tokens`: `BIGSERIAL` + `user_id BIGINT REFERENCES users(id) ON DELETE CASCADE` + `token_hash TEXT UNIQUE` + `expires_at TIMESTAMPTZ` + índice sobre `user_id`.
- `LoginRateLimiter` (`ratelimit.go`) es en memoria, por proceso, con `max`/`window` configurables — cada endpoint de auth nuevo instancia el suyo (ver `loginRateLimiter`, `passwordResetRateLimiter`, etc. en `main.go`).
- `apps/mobile/src/shared/http/external-api.service.ts::fetchJson` es el único punto por el que pasan todas las llamadas HTTP del cliente (auth y no-auth, incluidas APIs de terceros como vPIC) — no hay hoy ningún interceptor global ni distinción entre "llamada a nuestra API" y "llamada externa".
- No existe ningún endpoint de logout en el backend hoy — cerrar sesión es 100% local (`auth-section.ts::handleLogout`, solo limpia el repositorio de sesión).

## Goals / Non-Goals

**Goals:**
- Sesión larga (semanas/meses) sin volver a pedir contraseña, con revocación real posible (a diferencia del JWT stateless actual).
- Reutilizar al máximo lo ya existente: mismo generador de tokens, mismo patrón de tabla, mismo patrón de rate limiter.
- Cambio incremental y de bajo riesgo en el cliente: los servicios `*-api.service.ts` existentes no cambian su firma pública: solo el punto de entrada elegido (login/boot) empieza a pasar un objeto de sesión con capacidad de refresco.

**Non-Goals:**
- Migrar el almacenamiento del token de un `Session` en SQLite en texto plano a un almacén seguro nativo (Tauri keychain/keystore) — sigue siendo el mismo mecanismo de hoy, con el mismo riesgo ya aceptado implícitamente por el código actual. Candidato a spec futura si se decide abordarlo.
- Gestión multi-dispositivo de sesiones (listar/revocar sesiones activas desde la UI) — cerrar sesión revoca solo el refresh token del propio dispositivo, otros dispositivos logueados no se ven afectados.
- Detección de robo de refresh token mediante cascada de revocación de toda la familia de tokens (patrón OAuth2 avanzado) — con rotación de un solo uso ya se cierra el caso principal (un token robado y ya usado por el dueño legítimo queda inútil para el atacante); la detección activa de reuso como señal de alarma queda fuera de alcance.
- **Adopción de `sessionRefresh` en `friends-api`/`photo-cloud-api`/`avatar-api`/`achievement-api`/`route-sharing-api`/`notifications-api`** (decisión tomada durante `apply`, no anticipada al proponer este documento) — `fetchJson` ya soporta la opción de forma genérica y probada, y los dos escenarios que motivaron el cambio (renovación al abrir la app, subida automática de una ruta larga) quedan cubiertos por `checkUsernameGate()` y `handleRouteSaved()` respectivamente. Extenderlo a estos 7 servicios (≈25 funciones más sus llamadores en dominios distintos) es trabajo mecánico de bajo valor incremental mientras no haya evidencia real de que hace falta — cada uno ya maneja un 401 hoy sin regresión. Candidato a spec/tarea futura si el uso real lo pide.

## Decisions

**Formato del refresh token — opaco aleatorio, no JWT.** Reutiliza `generateOneTimeToken()`/`hashOneTimeToken()` de `verification_token.go` sin ninguna dependencia nueva. Alternativa descartada: un segundo JWT de vida larga — se descarta porque un JWT no se puede revocar sin mantener una lista de exclusión de todos modos, así que no aporta nada frente a un token opaco respaldado por tabla, y además un JWT de vida larga que además sea auto-verificable sin BBDD es exactamente el riesgo que se quiere evitar (ADR-057 nueva, ver `memory/decisions.md`).

**El access token sigue siendo JWT stateless — solo baja su TTL de 24h a 30 minutos.** El refresh token es el único componente nuevo con estado. Alternativa descartada: hacer también el access token stateful (una fila por sesión, verificada en cada petición) — se descarta porque anula la ventaja principal de usar JWT (verificar sin tocar la BBDD en cada petición autenticada) sin necesidad real, ya que la revocación solo importa para el componente de vida larga.

**Rotación de un solo uso en cada canje.** Cada `POST /api/auth/refresh` marca el refresh token recibido como revocado (`revoked_at = now()`) e inserta uno nuevo — nunca se reutiliza la misma fila. Un intento de canjear un token ya usado cae en el mismo camino de error que uno revocado por logout (mismo mensaje 401 genérico, ver spec). Alternativa descartada: token reutilizable hasta su expiración — más simple, pero un token robado seguiría siendo válido semanas sin ninguna señal de uso indebido.

**Refresh token de 60 días, access token de 30 minutos.** Explícito en `main.go` como constantes nuevas (`refreshTokenTTL`, `accessTokenTTL` reemplazando `tokenTTL`), mismo patrón que `loginRateLimitWindow`. 60 días balancea "casi nunca pedir contraseña" con un límite razonable de exposición si el dispositivo se pierde sin que el usuario cierre sesión.

**Logout revoca solo el refresh token del propio dispositivo.** Nuevo endpoint protegido `POST /api/auth/logout` (requiere `RequireAuth` con el access token todavía válido) recibe el refresh token en el body y lo revoca. Si el access token ya expiró en el momento de pulsar "Cerrar sesión" (raro, pero posible), el cliente limpia igualmente la sesión local — el refresh token queda huérfano hasta su expiración natural (60 días), aceptado como Non-Goal (gestión multi-dispositivo).

**Rate limiting del endpoint de refresh — mismo patrón que login, límite más alto.** Nueva instancia de `LoginRateLimiter` (`refreshRateLimiter`), `max=20`/`window=15min` frente a 5/15min de login — el refresco es automático (una vez por apertura de app o expiración de access token), no tecleado por un humano, así que un usuario legítimo con varios dispositivos o aperturas frecuentes no debe toparse con el límite; sigue acotando abuso.

**Cliente: opción de refresco añadida a `fetchJson`, no una función nueva paralela.** `fetchJson` gana un parámetro opcional `sessionRefresh: { sessionRepository, apiBaseUrl }`; si la petición devuelve 401 y se pasó esta opción, intenta `POST /api/auth/refresh` con el refresh token guardado, persiste los tokens nuevos en `sessionRepository` si tiene éxito, y repite la petición original una vez. Si el refresco falla, limpia la sesión y deja que el 401 original se propague tal cual hoy (ningún llamador existente rompe su contrato). Alternativa descartada: una función `fetchAuthenticated` separada — se descarta porque duplicaría toda la lógica de manejo de errores/timeout ya escrita en `fetchJson`, y los servicios existentes tendrían que migrar su firma en vez de solo añadir un argumento opcional.

**Renovación proactiva al abrir la app, no solo reactiva a un 401.** El cliente guarda `expiresAt` (epoch ms) junto al token, calculado a partir de un campo `expires_in` (segundos) que devuelven login/refresh — al arrancar, si `expiresAt` ya pasó (o está a menos de un margen corto), se intenta refrescar antes de la primera llamada a `/api/auth/me`, evitando una petición que se sabe que va a fallar.

## Risks / Trade-offs

- [Riesgo] `fetchJson` vive en `shared/http/` y lo consumen servicios de dominios distintos (auth, routes, friends, achievements...) → cambiar su firma tiene radio de impacto amplio. Mitigación: el parámetro nuevo es opcional y por defecto `undefined` (comportamiento actual sin cambios); cada servicio adopta `sessionRefresh` en su propia tarea de `tasks.md`, uno por uno, con sus tests existentes como red de seguridad.
- [Riesgo] Sesiones ya emitidas antes del despliegue (JWT de 24h sin refresh token asociado) dejarán de tener con qué renovarse. Mitigación: ver Migration Plan — es un único re-login forzado, no un fallo silencioso.
- [Riesgo] Un refresh token es tan sensible como una contraseña de sesión larga; sigue guardándose en SQLite en texto plano en el cliente (mismo nivel de protección que el access token hoy, ningún cambio a peor, pero tampoco a mejor). Mitigación: fuera de alcance de este cambio (ver Non-Goals), candidato a spec futura sobre almacenamiento seguro.
- [Riesgo] `LoginRateLimiter` es en memoria por proceso (ADR-034 ya documenta esta limitación para login) — un reinicio del servidor resetea los contadores también para `/api/auth/refresh`. Mismo riesgo ya aceptado, no se introduce uno nuevo.

## Migration Plan

1. Migración `0014_create_refresh_tokens.sql` — crea la tabla, sin tocar `users` ni datos existentes.
2. Desplegar backend: `tokenTTL` baja de 24h a 30 min, `/api/auth/refresh` y `/api/auth/logout` quedan disponibles. A partir de este momento, cualquier JWT de 24h ya emitido sigue siendo válido hasta su expiración original (el cambio de TTL solo afecta a tokens nuevos) — no hay corte abrupto para sesiones activas en ese instante.
3. Desplegar frontend (nueva versión de APK): sesiones guardadas con el formato viejo (`{ token, email }`, sin `refreshToken`/`expiresAt`) se detectan por la ausencia de `refreshToken` — el cliente no intenta refrescar (no tiene con qué) y, en el primer 401 tras el despliegue del backend, cae directo a login. El usuario vuelve a escribir su contraseña **una vez**; desde ese login ya recibe el refresh token nuevo y no debería volver a pedirla en semanas.
4. Sin rollback destructivo necesario: si hay que revertir, basta con desplegar el backend anterior (`tokenTTL` vuelve a 24h) — la tabla `refresh_tokens` queda sin usar pero no rompe nada, no hace falta migración de bajada.
