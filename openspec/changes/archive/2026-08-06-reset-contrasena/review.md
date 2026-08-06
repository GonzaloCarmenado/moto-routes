# Review: reset-contrasena

## CRÍTICO — leer primero

**Seguridad** (cambio de autenticación, se aplica el criterio completo de `rules.security`):
- **Sin criptografía hecha a mano**: token de reset con `crypto/rand`+`sha256` (`generateOneTimeToken`/`hashOneTimeToken`, compartidas con email-verification desde el rename de este mismo cambio), contraseñas con `bcrypt` ya existente. Ninguna implementación propia.
- **Sin secretos reales en el diff**: verificado con `git log -p master..feature/reset-contrasena` buscando el patrón de la API key real de Resend — cero coincidencias. `infra/docker/.env.example` sin diff en esta rama (el `.env` real, gitignored, se actualizó fuera de git).
- **Rate limiting**: `reset-password/request` limitado (3/15min, reutilizando `LoginRateLimiter`). `reset-password/confirm` no lo necesita — mismo criterio ya aceptado en ADR-038 para `verify-email/confirm`: el token tiene 256 bits de entropía, fuerza bruta inviable independientemente del rate limit.
- **Anti-enumeración**: `reset-password/request` responde el mismo éxito genérico exista o no la cuenta — verificado con test que compara las respuestas byte a byte.
- **El enlace no lleva email ni identificador de cuenta** — verificado con un test que inspecciona el HTML del email enviado (`TestRequestPasswordResetHandler_EmailLinkContainsOnlyTheTokenNotTheEmail`) y falla si el email aparece en cualquier parte del cuerpo.
- **La cuenta afectada se determina solo por el token** — verificado con un test que intenta colar `email`/`user_id` de otra cuenta en el `POST` del formulario (`TestResetPasswordConfirmHandler_PostWithExtraAccountFieldIsIgnored`): confirma que solo cambia la cuenta dueña real del token, y que la cuenta objetivo falsa queda intacta.
- **Caducidad**: `resetTokenTTL = 1 hora`, verificado tanto a nivel de store (`TestPostgresPasswordResetTokenStore_FindByHashReturnsExpiredTokensToo` — el store no oculta tokens caducados, el handler decide) como de handler (`TestResetPasswordConfirmHandler_ExpiredTokenIsRejectedOnGetAndPost`, en `GET` y `POST`).
- **`html/template`, no `text/template` ni `fmt.Sprintf`**, para renderizar la página — cualquier valor interpolado (`Token`, `ErrorMessage`) queda auto-escapado, sin XSS reflejado.

**Cambios en `src/shared/`**: ninguno — cambio 100% backend.

**Actualizaciones de dependencias core**: ninguna — `html/template`/`net/url` son librería estándar.

**Reglas del proyecto saltadas**: ninguna.

## Cobertura de Requirement/Scenario

### `specs/password-reset/spec.md` (capability nueva)

| Requirement | Scenario | Test |
|---|---|---|
| Solicitud sin enumerar | Cuenta existente | `request_password_reset_test.go::TestRequestPasswordResetHandler_ExistingAccountSendsEmail` |
| Solicitud sin enumerar | Email sin cuenta | `request_password_reset_test.go::TestRequestPasswordResetHandler_UnknownEmailRespondsGenericSuccessWithoutSendingEmail` |
| Solicitud sin enumerar | Solicitudes repetidas se limitan | `request_password_reset_ratelimit_test.go::TestRateLimitedRequestPasswordResetHandler_BlocksAfterMaxAttempts` |
| Solicitud sin enumerar | Enlace sin email/identificador | `request_password_reset_test.go::TestRequestPasswordResetHandler_EmailLinkContainsOnlyTheTokenNotTheEmail` |
| Enlace abre formulario | Token válido muestra el formulario | `reset_password_confirm_test.go::TestResetPasswordConfirmHandler_GetWithValidTokenShowsTheForm` |
| Enlace abre formulario | Token inválido/expirado/usado no muestra el formulario | `TestResetPasswordConfirmHandler_GetWithInvalidTokenDoesNotShowTheForm` + `TestResetPasswordConfirmHandler_ExpiredTokenIsRejectedOnGetAndPost` |
| Confirmar sustituye contraseña | Reset correcto | `TestResetPasswordConfirmHandler_PostWithValidTokenChangesPassword` |
| Confirmar sustituye contraseña | Contraseñas no coinciden | `TestResetPasswordConfirmHandler_PostWithMismatchedPasswordsIsRejected` |
| Confirmar sustituye contraseña | Contraseña débil | `TestResetPasswordConfirmHandler_PostWithWeakPasswordIsRejected` |
| Confirmar sustituye contraseña | Token usado/expirado/inexistente | `TestResetPasswordConfirmHandler_PostWithUsedExpiredOrUnknownTokenIsRejectedTheSameWay` |
| Confirmar sustituye contraseña | Login con contraseña nueva funciona | `TestResetPasswordConfirmHandler_CompletedResetAllowsLoginWithNewPasswordOnly` |
| Confirmar sustituye contraseña | Login con contraseña anterior falla | mismo test (verifica ambos casos) |
| Confirmar sustituye contraseña | Campo de cuenta añadido a mano se ignora | `TestResetPasswordConfirmHandler_PostWithExtraAccountFieldIsIgnored` |
| Token caduca en tiempo corto | Token caducado se trata igual que inválido | `TestResetPasswordConfirmHandler_ExpiredTokenIsRejectedOnGetAndPost` + `password_reset_token_store_test.go::TestPostgresPasswordResetTokenStore_FindByHashReturnsExpiredTokensToo` |

**Cobertura automatizada: 14/14 escenarios (100%).**

**Verificación manual (requiere servicios externos y un navegador real)**:
- Formulario visto y confirmado visualmente por el usuario en un navegador real (estilo "Asfalto Nocturno") — local. Estado: **hecho**.
- Envío/recepción real de email, flujo completo local y producción, contraseña realmente cambiada (round-trip de login). Estado: **hecho**, incluyendo un hallazgo real (política mínima de contraseña rechazando de verdad un intento de 6 caracteres en producción — confirma que la validación no es solo client-side).
- Migración `0004` aplicándose sola en producción. Estado: **hecho**.
- Limpieza de la cuenta de prueba en producción. Estado: **hecho**, `count(*) = 0`.

## Otros hallazgos (no bloqueantes)

- **[Calidad, menor, mismo patrón ya aceptado en ADR-038]** `handleResetPasswordConfirmPost` hace `UpdatePasswordHash` → `MarkEmailVerified` → `MarkUsed` como tres operaciones separadas, no en una transacción. Si el proceso muere entre la primera y la última, la contraseña ya cambió pero el token podría seguir sin marcarse usado — permitiría un segundo `POST` con el mismo token que vuelva a "cambiar" la contraseña a sí misma (no a otra cuenta, la lectura del token sigue apuntando al mismo `user_id`). No es una vulnerabilidad explotable contra otra cuenta, es una ventana de inconsistencia rara. No bloqueante.
- **[Deuda documentada, no de este cambio]** Los valores de color de "Asfalto Nocturno" están duplicados como constantes en `reset_password_page.go` — si la paleta de `tokens.css` cambia, hay que actualizar este fichero a mano. Anotado en ADR-039, aceptado por ser una sola página de bajo impacto.

## Veredicto

**APPROVED**

Los 14 escenarios de la spec nueva tienen cobertura automatizada 1:1, incluyendo tests dedicados para las tres garantías de seguridad que pidió explícitamente el usuario (caducidad, cuenta derivada solo del token, enlace sin email). Verificación manual completa en local (formulario visto en navegador real) y producción (incluyendo que la política de contraseña mínima se confirmó rechazando de verdad un intento débil, no solo en tests). Sin secretos reales en el diff, sin criptografía hecha a mano, sin cambios en `src/shared/` ni dependencias nuevas. Los dos hallazgos de calidad son menores y quedan anotados.
