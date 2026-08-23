# Review: renovacion-token-sesion

## CRÍTICO (leer primero)

- **Seguridad**: sin criptografía hecha a mano — el refresh token reutiliza `generateOneTimeToken()`/`hashOneTimeToken()` (`crypto/rand` + `sha256`) ya existentes en `verification_token.go`, mismo patrón que verificación de email y reset de contraseña. El access token sigue siendo el JWT ya existente (`golang-jwt/jwt/v5`), sin tocar su verificación de firma. Sin secretos reales en el diff (`git diff` + grep de patrones, revisado explícitamente — ver tasks.md 8.3). CSP no se toca (sin endpoints nuevos de origen externo). Inputs del body (`refresh_token`) se decodifican con `json.NewDecoder`, sin interpolación en SQL (siempre vía `$1`/`$2` parametrizados).
- **Rate limiting**: `POST /api/auth/refresh` tiene su propio `LoginRateLimiter` (`refreshRateLimiter`, 20/15min) — no asume que el límite de login cubre el endpoint nuevo. `POST /api/auth/logout` no lleva rate limiting propio: va detrás de `RequireAuth`, que ya exige un access token válido — no es un endpoint de autenticación en el sentido del criterio (no verifica credenciales ni emite nada), mismo criterio ya aplicado a otros endpoints protegidos de la API.
- **Anti-enumeración**: ninguno de los dos endpoints nuevos recibe email/username, así que no hay superficie de enumeración de cuentas que abrir. El 401 de `/api/auth/refresh` es deliberadamente el mismo para expirado/revocado/inexistente (spec explícita: "sin distinguir en la respuesta").
- **`src/shared/` (frontend)**: `external-api.service.ts` (`fetchJson`) y `shared/models/session.types.ts` cambian — radio de impacto amplio (todo `*-api.service.ts` del proyecto pasa por `fetchJson`). Mitigado: el parámetro nuevo (`sessionRefresh`) es opcional, por defecto `undefined`, comportamiento idéntico a hoy para todo llamador que no lo pase — confirmado con la suite completa (Vitest 1384/1384, Cypress 98/98) sin ninguna regresión.
- **Decisión de arquitectura no anticipada en `design.md`**: `auth/session-refresh.service.ts` vive en `auth/`, no en `shared/` — `shared/` nunca importa de un dominio en este proyecto (sin precedente hasta ahora) y crear el helper ahí habría invertido esa dependencia. Documentado en tasks.md 5.5, no requiere ADR propia (detalle de ubicación de código, no una decisión con alternativas reales evaluadas).
- **Norma del proyecto saltada, con justificación documentada**: el alcance del grupo 6 (tasks.md) se recortó conscientemente durante `apply` — `sessionRefresh` no se adoptó en 6 de los ~9 servicios API autenticados existentes (amigos, fotos, avatar, logros, compartir, notificaciones). Documentado en `design.md` (Non-Goals) y `memory/context.md`: los dos escenarios pedidos explícitamente por el usuario quedan cubiertos por renovación proactiva en los dos puntos reales que importan; el resto no es una regresión (mismo comportamiento de 401 que ya tenían), solo queda sin la mejora. Confirmado con el usuario en la propia sesión antes de proceder ("sí, mucho más lógico").
- **BREAKING confirmado y documentado**: tras desplegar, cualquier JWT de 24h ya emitido queda sin refresh token asociado — sus usuarios necesitan un único re-login. Ver Migration Plan en `design.md`.

## Cobertura: Requirement → Scenario → Test

### `user-auth` — Login emite un token de sesión válido (MODIFIED)
| Scenario | Test |
|---|---|
| Login correcto devuelve access token y refresh token | `login_test.go::TestLoginHandler_ValidCredentialsReturnAToken`, `::TestLoginHandler_ValidCredentialsReturnExpiresIn`; E2E `session-refresh.cy.ts` ("el login devuelve...") |
| Login rechazado por credenciales incorrectas (sin token) | `login_test.go::TestLoginHandler_UnknownEmailAndWrongPasswordReturnTheSameGenericError` (pre-existente, revalidado) |
| Login rechazado por email sin verificar (sin token) | `login_test.go::TestLoginHandler_CorrectCredentialsButUnverifiedEmailIsRejected` (pre-existente, revalidado) |

### `user-auth` — Un refresh token vigente se puede canjear por un access token nuevo sin contraseña (ADDED)
| Scenario | Test |
|---|---|
| Canje correcto | `refresh_test.go::TestRefreshHandler_ValidTokenReturnsNewAccessAndRefreshToken`; E2E "canjear el refresh token..." |
| Canje rechazado — expirado | `refresh_test.go::TestRefreshHandler_ExpiredTokenIsRejected` |
| Canje rechazado — revocado o ya usado | `refresh_test.go::TestRefreshHandler_RevokedTokenIsRejected`, `::TestRefreshHandler_RotatesTheOldRefreshTokenSoItCannotBeReused`; `refresh_token_store_test.go::TestPostgresRefreshTokenStore_RotateInvalidatesTheOldToken`, `::TestPostgresRefreshTokenStore_RevokeThenRotateFails`; E2E "canjear..." (reuso rechazado) |
| Canje rechazado — inexistente/manipulado | `refresh_test.go::TestRefreshHandler_UnknownTokenIsRejected`, `::TestRefreshHandler_MissingTokenIsRejected`; `refresh_token_store_test.go::TestPostgresRefreshTokenStore_RotateRejectsUnknownHash` |
| Límite de intentos | `refresh_ratelimit_test.go::TestRateLimitedRefreshHandler_BlocksAfterTooManyFailedAttempts`, `::TestRateLimitedRefreshHandler_SuccessfulRefreshIsNotRateLimited` |

### `user-auth` — Cerrar sesión revoca el refresh token (ADDED)
| Scenario | Test |
|---|---|
| Logout invalida el refresh token para futuros canjes | `logout_test.go::TestLogoutHandler_RevokesTheRefreshTokenForFutureExchanges`; E2E "cerrar sesión revoca..." |

### `user-auth` — La app renueva el access token de forma silenciosa antes de forzar el logout (ADDED)
| Scenario | Test |
|---|---|
| Abrir la app con el access token caducado renueva sin pedir contraseña | `session-refresh.service.spec.ts::ensureFreshSession` (4 tests); `app-username-gate.spec.ts::resolveUsernameGateSession` (4 tests); E2E "un 401 al comprobar la sesión..."; **manual en dispositivo real** (ver abajo) |
| Una petición 401 se reintenta una vez tras renovar | `external-api.service.spec.ts` — bloque "con sessionRefresh, en un 401..." (5 tests); `auth-api.service.spec.ts::fetchCurrentUser` "con sessionRefresh..."; `route-cloud-api.service.spec.ts::uploadRoute` "con sessionRefresh..." |
| Si la renovación también falla, pide login de nuevo | `external-api.service.spec.ts` "si la renovación también falla, limpia la sesión..."; `session-refresh.service.spec.ts` "si la renovación falla, devuelve la sesión..." |

### `user-auth` — Los endpoints protegidos exigen un token de sesión válido (sin cambios)
Pre-existente, revalidado sin regresión: `middleware_test.go` (4 tests, `TestRequireAuth_*`).

**Cobertura de escenarios: 100%** (todo scenario del delta tiene al menos un test automatizado). Dos verificaciones manuales:
- ✅ **Hecha**: renovación silenciosa al abrir la app con el access token expirado, en dispositivo Android real (`75fe536b`), `accessTokenTTL` bajado temporalmente a 1 min y revertido después — confirmado por el usuario.
- ⚠️ **Pendiente**: una ruta real de más de 30 minutos subiendo sola sin interrupción — cubierta solo por el test unitario de `handleRouteSaved` (mock de `ensureFreshSession`), no por una grabación real. Candidato a confirmar la próxima vez que se grabe una ruta larga real (tasks.md 7.4).

## Hallazgos por categoría

- **Gap**: ninguno — alcance descoped del grupo 6 documentado explícitamente como decisión, no como gap sin más.
- **Desviación**: ninguna respecto al delta spec sincronizado.
- **Calidad**: sin hallazgos — `tsc --noEmit`, `eslint --max-warnings 0` y `go vet` limpios; funciones nuevas con JSDoc/comentarios Go explicando el porqué, no el qué.
- **Cobertura**: 100% de escenarios con test automatizado (ver tabla arriba); dos bugs reales de test encontrados y corregidos al escribir el E2E (ver `memory/context.md`, no defectos de la implementación).
- **Convenciones de frontend**: `app-username-gate.ts` extraído de `app.element.ts` por límite de líneas (`max-lines`), con el sufijo-sin-sufijo ya documentado en `CLAUDE.md` y JSDoc explicando el porqué — consistente con el patrón ya usado por `app-route-upload.ts`/`app-seed.service.ts`.

## Veredicto: **APPROVED**

Sin problemas de seguridad, sin gaps de cobertura, sin desviaciones del spec. El único punto abierto (7.4, ruta larga real) es una verificación manual complementaria de un mecanismo ya cubierto por test unitario, no un bloqueante.
