## 1. Migración y modelo de datos

- [x] 1.1 Test de integración en rojo: `migrate.Run` aplica `0004_add_password_reset.sql` sin error.
- [x] 1.2 Crear `apps/api/internal/migrate/migrations/0004_add_password_reset.sql` (tabla `password_reset_tokens`, mismo shape que `email_verification_tokens` — ver `design.md`). Test en verde.

## 2. Reutilización del token de un solo uso

- [x] 2.1 Renombrado `generateVerificationToken`/`hashVerificationToken` a `generateOneTimeToken`/`hashOneTimeToken` en `verification_token.go` y `verification_token_test.go` (rename mecánico, sin fase roja real — no hay comportamiento nuevo que probar). Constante `verificationTokenBytes` → `oneTimeTokenBytes`.
- [x] 2.2 Actualizadas las llamadas existentes en `request_verification.go`/`confirm_verification.go`/`confirm_verification_test.go`. Suite completa de `apps/api` en verde (70/70).

## 3. Store de tokens de reset

- [x] 3.1 Test rojo: `PasswordResetTokenStore` (interfaz nueva, mismo shape que `VerificationTokenStore`) — crear token con `expires_at` = ahora + `resetTokenTTL` (1 hora), invalidar tokens previos sin usar del usuario, buscar por hash, marcar como usado.
- [x] 3.2 Implementar `PostgresPasswordResetTokenStore` contra `password_reset_tokens`. Test de integración real (Postgres vía `internal/dbtest`) en verde.
- [x] 3.3 Test rojo: buscar un token cuyo `expires_at` ya pasó devuelve el registro igualmente (la caducidad la evalúa el handler comparando con `time.Now()`, igual que `ConfirmVerificationHandler` — el store no filtra por fecha, solo por hash) — confirma que el store no oculta tokens caducados, para que el handler pueda decidir el motivo del rechazo.

## 4. Endpoint de solicitud (`POST /api/auth/reset-password/request`)

- [x] 4.1 Test rojo: cuenta existente → genera token nuevo, invalida el anterior sin usar, envía email, responde éxito genérico.
- [x] 4.2 Test rojo: email sin cuenta asociada → mismo éxito genérico, sin enviar email.
- [x] 4.3 Test rojo: el HTML del email enviado (vía `email.FakeSender.Sent[].HTML` en el test) contiene el token en la URL de confirmación pero **no** contiene el email de la cuenta en ninguna parte del enlace.
- [x] 4.4 Implementar `RequestPasswordResetHandler` cubriendo 4.1-4.3. Tests en verde.
- [x] 4.5 Test rojo + implementación: envolver con una instancia de `LoginRateLimiter` limitando solicitudes repetidas por email (mismo patrón que `verify-email/request`).

## 5. Página de confirmación con formulario (`GET`/`POST /api/auth/reset-password/confirm`)

- [x] 5.1 Implementado `apps/api/internal/auth/reset_password_page.go`: plantilla `html/template` con los valores de color de "Asfalto Nocturno" embebidos (copiados de `tokens.css`, comentario apuntando a la fuente de verdad), formulario `password`/`password_confirmation`/token oculto, y variantes de error/éxito/enlace-inválido.
- [x] 5.2 Test rojo→verde: `GET` con token válido, no expirado, no usado → responde `200` con el formulario (confirmado que el HTML contiene el campo del token).
- [x] 5.3 Test rojo→verde: `GET` con token inválido/nunca emitido → responde página sin formulario.
- [x] 5.4 Test rojo→verde: `POST` con token válido y contraseñas coincidentes que cumplen la política → sustituye el hash de contraseña, invalida el token, marca `email_verified = true` (la cuenta de prueba no estaba verificada), responde página de éxito.
- [x] 5.5 Test rojo→verde: `POST` con contraseñas que no coinciden → rechaza sin cambiar la contraseña, vuelve a mostrar el formulario con el motivo.
- [x] 5.6 Test rojo→verde: `POST` con contraseña que no cumple la política mínima → mismo tratamiento, contraseña sin cambiar.
- [x] 5.7 Test rojo→verde: `POST` con token ya usado/expirado/inexistente → mismo status en los tres casos, ninguna contraseña cambiada.
- [x] 5.8 Test rojo→verde: `POST` con token válido de la cuenta A + campos extra `email`/`user_id` apuntando a la cuenta B → solo cambia A, B verificada intacta con su contraseña original.
- [x] 5.9 Test rojo→verde: token con `expires_at` en el pasado se rechaza igual que uno inexistente, tanto en `GET` como en `POST`.
- [x] 5.10 Implementado `ResetPasswordConfirmHandler` (`GET`/`POST` según método) cubriendo 5.2-5.9 — el `user_id` se lee siempre de `PasswordResetTokenStore.FindByHash`, `r.ParseForm()`/`PostFormValue` solo se leen para `token`/`password`/`password_confirmation`. Añadido `UserStore.UpdatePasswordHash` (no existía, necesario para sustituir el hash) — implementado en `PostgresUserStore` y `fakeUserStore` de test, mismo patrón que `MarkEmailVerified`. Tests en verde (9/9 de este grupo, 90/90 en todo el módulo).
- [x] 5.11 Test rojo→verde: tras un reset completado, `login` con la contraseña nueva funciona (200) y con la anterior falla (401) — round-trip real vía `LoginHandler`, no solo el hash guardado.

## 6. Wiring

- [x] 6.1 `apps/api/cmd/api/main.go`: `PostgresPasswordResetTokenStore`, nueva instancia de `LoginRateLimiter` (3/15min) para el rate limit de solicitud, rutas `POST /api/auth/reset-password/request` y `GET`+`POST /api/auth/reset-password/confirm`. Sin variables de config nuevas.
- [x] 6.2 `go build ./...` limpio, suite completa en verde (90/90), `go vet`/`govulncheck` limpios (0 vulnerabilidades alcanzables, misma excepción ya documentada).

## 7. Verificación real

- [x] 7.1 `docker compose up --build` local: solicitud real de reset, email recibido (**gap real encontrado**: `infra/docker/.env` seguía con el remitente sandbox `onboarding@resend.dev`, ya agotado desde la sesión de `confirmacion-email-usuarios` — corregido a `no-reply@motor-routes.com`, mismo dominio ya verificado en producción), enlace abierto en un navegador real (confirmado visualmente por el usuario: fondo oscuro, panel, botón ámbar), formulario enviado con contraseña nueva, login con la contraseña anterior rechazado (401) y con la nueva aceptado (200 con token).
- [x] 7.2 Desplegado desde `feature/reset-contrasena` sin fusionar (imagen anterior etiquetada `docker-api:pre-reset-contrasena`), migración `0004` aplicada sola. Registro real → solicitud de reset → email recibido → formulario real completado por el usuario (con verificación cruzada: primer intento con una contraseña de 6 caracteres fue rechazado de verdad server-side, confirmando la política mínima) → login con la contraseña nueva (`200`, token válido) desde fuera del tailnet. Cuenta de prueba borrada de producción, `count(*) = 0` en `users` y `password_reset_tokens`.

## 8. Cierre

- [x] 8.1 Actualizado `memory/context.md` con el resumen completo de la sesión.
- [x] 8.2 Nueva `memory/decisions.md::ADR-039` (enlaza ADR-038, no lo duplica) con las decisiones técnicas, el gap real encontrado y la verificación end-to-end en local y producción.
