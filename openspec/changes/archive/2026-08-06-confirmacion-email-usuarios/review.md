# Review: confirmacion-email-usuarios

## CRÍTICO — leer primero

**Seguridad** (cambio de autenticación, se aplica el criterio completo de `rules.security`):
- **Sin criptografía hecha a mano**: token de verificación con `crypto/rand` (256 bits) + hash `sha256` (`verification_token.go`), contraseñas con `bcrypt` (ya existente, sin tocar), JWT con `golang-jwt/jwt/v5` (ya existente, sin tocar). Ninguna implementación propia.
- **Sin secretos reales en el diff**: verificado con `git log -p master..feature/confirmacion-email-usuarios` buscando el patrón de la API key real de Resend usada durante la verificación — cero coincidencias. `infra/docker/.env` (donde vive la key real) nunca ha estado trackeado por git. Los ficheros versionados (`.env.example`, `.env.prod.example`) solo tienen placeholders triviales o campos vacíos.
- **Rate limiting en los tres endpoints de autenticación de este cambio**: `register` (**gap real encontrado durante esta misma revisión — ver más abajo, corregido antes de archivar**), `verify-email/request` (3/15min), y `login` ya lo tenía desde ADR-034. `verify-email/confirm` no lo necesita (no revela nada por sí solo; el rate limit relevante es el de `request`, que es quien emite tokens).
- **Anti-enumeración**: `verify-email/request` responde el mismo éxito genérico exista la cuenta, no exista, o ya esté verificada — verificado con test que compara byte a byte las respuestas (`TestRequestVerificationHandler_UnknownEmailRespondsGenericSuccessWithoutSendingEmail`). `login` rechaza con el mismo error genérico credenciales incorrectas/email inexistente (sin cambios, ya existía); el nuevo caso "email sin verificar" se distingue deliberadamente porque el atacante ya demostró conocer la contraseña en ese punto — no es una enumeración nueva, está documentado en el propio código y en el delta de `user-auth`. **Nota fuera de alcance, verificada como no regresión**: `register` sigue devolviendo `409` en email duplicado — comportamiento ya documentado explícitamente en el `user-auth` spec aceptado desde ADR-034, este cambio no lo toca ni lo empeora.

**Cambios en `src/shared/`**: ninguno — cambio 100% backend (`apps/api/`), sin tocar `apps/mobile/`.

**Actualizaciones de dependencias core**: ninguna — decisión explícita de `design.md` de no añadir el SDK `resend-go`, llamada REST directa con `net/http`. `go.mod` sin cambios.

**Reglas del proyecto saltadas**: ninguna sin corregir. Una sí se detectó a medio camino y se corrigió en el momento (ver "Hallazgo corregido durante la revisión" abajo) — no queda como gap en el archive.

## Hallazgo corregido durante esta revisión

- **[Gap, corregido]** `register` no tenía rate limiting pese a que `rules.security` lo exige explícitamente para "login, registro, solicitud de token de un solo uso", y desde este cambio cada registro dispara además una llamada a Resend (cuota externa limitada) — un abuso del endpoint ya no solo escribía filas de más. Corregido con `RateLimitedRegisterHandler` (mismo patrón que `RateLimitedRequestVerificationHandler`), test `TestRateLimitedRegisterHandler_BlocksAfterMaxAttempts`, wiring en `main.go`. Commit aparte, suite completa re-verificada en verde (69/69) tras el fix.

## Cobertura de Requirement/Scenario

### `specs/email-verification/spec.md` (capability nueva)

| Requirement | Scenario | Test |
|---|---|---|
| Registro dispara verificación | Registro correcto dispara envío | `register_test.go::TestRegisterHandler_ValidDataStartsWithEmailUnverifiedAndSendsVerificationEmail` |
| Registro dispara verificación | Fallo de envío no bloquea la cuenta | `register_test.go::TestRegisterHandler_EmailSendFailureDoesNotBlockAccountCreation` |
| Solicitud sin enumerar | Cuenta existente sin verificar | `request_verification_test.go::TestRequestVerificationHandler_ExistingUnverifiedAccountSendsEmail` |
| Solicitud sin enumerar | Email sin cuenta asociada | `request_verification_test.go::TestRequestVerificationHandler_UnknownEmailRespondsGenericSuccessWithoutSendingEmail` |
| Solicitud sin enumerar | Cuenta ya verificada | `request_verification_test.go::TestRequestVerificationHandler_AlreadyVerifiedAccountDoesNotIssueANewToken` |
| Solicitud sin enumerar | Solicitudes repetidas se limitan | `request_verification_ratelimit_test.go::TestRateLimitedRequestVerificationHandler_BlocksAfterMaxAttempts` (+ `_DifferentEmailsHaveIndependentLimits`) |
| Confirmación marca verificada | Token válido | `confirm_verification_test.go::TestConfirmVerificationHandler_ValidTokenVerifiesTheAccount` |
| Confirmación marca verificada | Token ya usado | `confirm_verification_test.go::TestConfirmVerificationHandler_AlreadyUsedTokenIsRejectedWithoutChangingState` |
| Confirmación marca verificada | Token expirado | `confirm_verification_test.go::TestConfirmVerificationHandler_ExpiredTokenIsRejectedWithoutVerifying` |
| Confirmación marca verificada | Token inexistente/manipulado | `confirm_verification_test.go::TestConfirmVerificationHandler_UnknownTokenGetsTheSameErrorAsExpired` |

### `specs/user-auth/spec.md` (delta MODIFIED)

| Requirement | Scenario | Test |
|---|---|---|
| Login emite token | Login correcto (cuenta verificada) | `login_test.go::TestLoginHandler_ValidCredentialsReturnAToken` (fixture actualizado) |
| Login emite token | Credenciales incorrectas | `login_test.go::TestLoginHandler_UnknownEmailAndWrongPasswordReturnTheSameGenericError` |
| Login emite token | Email sin verificar | `login_test.go::TestLoginHandler_CorrectCredentialsButUnverifiedEmailIsRejected` |

**Cobertura automatizada: 14/14 escenarios (100%).**

**Verificación manual (no automatizable con `go test`, requiere servicios externos reales)**:
- Envío/recepción real de email vía Resend y clic real en el enlace — local (`docker compose`) y producción (`https://debian.taildf3dab.ts.net`, fuera del tailnet). Estado: **hecho**, ver `tasks.md` 8.2/8.3 y ADR-038.
- Migración `0003` aplicándose sola en producción real. Estado: **hecho**, confirmado por `psql` contra `schema_migrations`.
- Limpieza de la cuenta de prueba en producción. Estado: **hecho**, `count(*) = 0` confirmado.

## Otros hallazgos (no bloqueantes)

- **[Calidad, menor]** `ConfirmVerificationHandler` llama `userStore.MarkEmailVerified` y `tokenStore.MarkUsed` como dos operaciones separadas, no en una transacción — si el proceso muere entre ambas, la cuenta queda verificada pero el token sigue sin marcarse usado (podría reutilizarse una vez más, sin efecto real porque `MarkEmailVerified` es idempotente). No es una vulnerabilidad, es una ventana de inconsistencia muy pequeña en un caso de fallo raro (crash a mitad de un `UPDATE`). No bloqueante; candidato a envolver en transacción en un futuro cambio si se toca esta zona por otro motivo.
- **[Calidad, menor]** `RequestVerificationHandler` hace más trabajo (generar token, escribir en BD, llamar a Resend) cuando la cuenta existe y no está verificada que cuando no existe o ya lo está — asimetría de tiempo de respuesta observable en teoría. Mismo patrón ya presente en `login.go` desde antes de este cambio (el `bcrypt.CompareHashAndPassword` solo se ejecuta si el usuario existe) y nunca señalado como bloqueante en revisiones anteriores — consistente con el nivel de rigor ya aceptado en el proyecto, no una regresión de este cambio.
- **[Deuda documentada, no de este cambio]** `LoginRateLimiter` es genérico pese a su nombre — ahora se reutiliza tres veces (login, verify-email/request, register) con ese nombre específico de login. Anotado como rename pendiente en ADR-038, deliberadamente no hecho en este cambio para no ampliar el diff.

## Veredicto

**APPROVED**

Los 14 escenarios de las dos specs (una nueva, una modificada) tienen cobertura automatizada 1:1, la verificación manual con servicios externos reales está hecha y documentada (local y producción, incluyendo limpieza de datos de prueba), el único gap de seguridad real encontrado durante esta misma revisión (rate limiting ausente en `register`) se corrigió antes de cerrar — no queda como pendiente. Sin secretos reales en el diff, sin criptografía hecha a mano, sin cambios en `src/shared/` ni dependencias core nuevas. Los dos hallazgos de calidad restantes son menores, no bloqueantes, y quedan anotados para no perderlos.
