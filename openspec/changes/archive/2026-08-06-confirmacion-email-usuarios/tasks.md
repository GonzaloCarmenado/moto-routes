## 1. Migración y modelo de datos

- [x] 1.1 Test de integración (contra Postgres real vía `internal/dbtest`) en rojo: `migrate.Run` aplica `0003_add_email_verification.sql` sin error sobre una base con `0001`/`0002` ya aplicadas.
- [x] 1.2 Crear `apps/api/internal/migrate/migrations/0003_add_email_verification.sql` (columna `email_verified` en `users`, tabla `email_verification_tokens`, índice por `user_id` — ver `design.md`). Test en verde.
- [x] 1.3 Ampliar `StoredUser` (`user.go`) con `EmailVerified bool` y actualizar `UserStore`/`PostgresUserStore` (`FindUserByEmail`, `FindUserByID`, `CreateUser`) para leer/devolver la columna nueva. Test rojo→verde en `postgres_store_test.go`. También se añadió `MarkEmailVerified` a `UserStore` (necesario para el grupo 5, natural extensión de la interfaz en este mismo punto).

## 2. Tokens de verificación

- [x] 2.1 Test rojo: generar un token con `crypto/rand` produce valores de longitud y alfabeto esperados, sin colisiones en N generaciones sucesivas.
- [x] 2.2 Implementar `apps/api/internal/auth/verification_token.go`: generación (`crypto/rand`), hash (`crypto/sha256`) y comparación — sin librería nueva. Test en verde.
- [x] 2.3 Test rojo: `VerificationTokenStore` (interfaz nueva, análoga a `UserStore`) — crear token, invalidar tokens previos sin usar de un usuario, buscar por hash, marcar como usado.
- [x] 2.4 Implementar `PostgresVerificationTokenStore` contra `email_verification_tokens`. Test de integración real (Postgres vía `internal/dbtest`) en verde.

## 3. Envío de email (Resend)

- [x] 3.1 Test rojo: `email.Sender` (interfaz) — `ResendSender.Send` construye la petición HTTP correcta (URL, header `Authorization: Bearer`, JSON body) contra un `httptest.Server` que simula la API de Resend; propaga error si Resend responde con status de error.
- [x] 3.2 Implementar `apps/api/internal/email/resend.go` (`Sender`, `ResendSender`) sobre `net/http` estándar, sin SDK nuevo. Test en verde.
- [x] 3.3 Implementar `FakeSender` (test double) en el propio paquete `email` para reutilizar en los tests de los handlers de los grupos 4 y 5.
- [x] 3.4 Plantilla del cuerpo del email (HTML mínimo, sin depender de `src/shared/styles/tokens.css` — es un email, no la app) con el enlace de confirmación construido a partir de `PUBLIC_API_BASE_URL` + token. Nota: `ResendSender` necesita también un remitente (`From`) que Resend exige — no estaba en `design.md`; se añade como `RESEND_FROM_ADDRESS` en la config del grupo 7, mismo patrón que las demás variables de entorno no secretas de despliegue.

## 4. Endpoint de solicitud/reenvío (`POST /api/auth/verify-email/request`)

- [x] 4.1 Test rojo: cuenta existente sin verificar → genera token nuevo, invalida el anterior sin usar, llama a `Sender.Send`, responde éxito genérico.
- [x] 4.2 Test rojo: email sin cuenta asociada → responde el mismo éxito genérico, sin llamar a `Sender.Send` (anti-enumeración).
- [x] 4.3 Test rojo: cuenta ya verificada → responde el mismo éxito genérico, sin generar token ni enviar email.
- [x] 4.4 Implementar `RequestVerificationHandler` cubriendo 4.1-4.3. Tests en verde.
- [x] 4.5 Test rojo + implementación: envolver con una segunda instancia de `LoginRateLimiter` (ver `design.md`) limitando solicitudes repetidas por email.

## 5. Endpoint de confirmación (`GET /api/auth/verify-email/confirm`)

- [x] 5.1 Test rojo: token válido, no expirado, no usado → marca `email_verified = true`, marca el token como usado, responde `200` con HTML mínimo de éxito.
- [x] 5.2 Test rojo: token ya usado → responde error sin volver a tocar el estado de verificación.
- [x] 5.3 Test rojo: token expirado → responde error sin verificar la cuenta.
- [x] 5.4 Test rojo: token inexistente/manipulado → mismo tipo de error que el expirado, sin distinguir el motivo.
- [x] 5.5 Implementar `ConfirmVerificationHandler` cubriendo 5.1-5.4. Tests en verde.

## 6. Registro y login existentes

- [x] 6.1 Test rojo: `RegisterHandler` crea la cuenta con `email_verified = false` y dispara el envío del primer email de verificación.
- [x] 6.2 Test rojo: si `Sender.Send` falla, `RegisterHandler` crea la cuenta igualmente y responde éxito (best-effort, ver `design.md`).
- [x] 6.3 Implementar los cambios de 6.1-6.2 en `register.go`. Tests en verde. `RegisterHandler` gana dos parámetros (`VerificationTokenStore`, `email.Sender`, `publicBaseURL`); `doRegister` en los tests se mantuvo con la misma firma de llamada envolviendo fakes desechables, así que el resto de tests de `register_test.go` no tuvo que tocarse.
- [x] 6.4 Test rojo: `LoginHandler` con credenciales correctas pero `email_verified = false` → rechaza con un error distinguible del de credenciales incorrectas (ver spec delta de `user-auth`).
- [x] 6.5 Implementar el cambio en `login.go` (403, mensaje `emailNotVerifiedMessage`). Test en verde. Dos tests existentes que pasaban tuvieron que actualizar su fixture (marcar la cuenta verificada tras registrar) porque el propio cambio invalida deliberadamente el supuesto de que una cuenta recién registrada puede loguear: `TestLoginHandler_ValidCredentialsReturnAToken` y `TestRateLimitedLoginHandler_SuccessfulLoginIsNotRateLimited`, ambos con comentario explicando el porqué.
- [x] 6.6 Test rojo + implementación: `MeHandler`/`meResponse` (`me.go`) añade `email_verified` a la respuesta.

## 7. Configuración y wiring

- [x] 7.1 Test rojo: `config.Load()` exige `RESEND_API_KEY` y `PUBLIC_API_BASE_URL` (esta última validando que empieza por `https://`, ver Risks en `design.md`). También `RESEND_FROM_ADDRESS` (gap detectado en la tarea 3.4, Resend exige remitente).
- [x] 7.2 Implementar los cambios en `apps/api/internal/config/`. Tests en verde.
- [x] 7.3 Wiring en `apps/api/cmd/api/main.go`: `PostgresVerificationTokenStore`, `ResendSender`, segundo `LoginRateLimiter` (3 solicitudes/15 min), rutas `POST /api/auth/verify-email/request` y `GET /api/auth/verify-email/confirm`. `go build ./...` y suite completa (68 tests, 10 paquetes) en verde, `go vet` limpio.
- [x] 7.4 Añadidas `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`/`PUBLIC_API_BASE_URL` a `infra/docker/.env.example`, `.env` local (placeholders triviales, `https://localhost` para pasar la validación sin ser alcanzable de verdad) y `.env.prod.example`. Revisado `.github/workflows/ci.yml`: no hace falta ningún secret nuevo — `go build`/`go vet`/`govulncheck` no invocan `config.Load()` en tiempo de compilación, y los tests de `config` fijan su propio entorno vía `t.Setenv`; el despliegue real de `apps/api` no pasa por CI (SSH manual, mismo patrón que ADR-032/033/034).

## 8. Verificación real end-to-end

- [x] 8.1 `go vet` y `govulncheck` limpios (0 vulnerabilidades alcanzables, misma excepción ya documentada). `gofmt -l` marca casi todo el árbol por CRLF de este checkout Windows — preexistente, no introducido por este cambio, y el pre-commit local no lo comprueba (solo `govulncheck`; el `gofmt --check` de CI corre en Linux).
- [x] 8.2 `docker compose up --build` local con una cuenta real de Resend (sandbox, remitente `onboarding@resend.dev`, API key del usuario — nunca compartida en el chat, puesta directamente en `infra/docker/.env` por el propio usuario). Registro real (`gonzalocarmenado@gmail.com`) → email recibido de verdad → confirmado con el token real → login pasó de 403 a 200 → reintentar el mismo token da 400 (no reutilizable). **Gap real encontrado, no detectable sin probar contra un servicio externo real**: el primer intento de envío falló con `tls: failed to verify certificate: x509: certificate signed by unknown authority` — `debian:trixie-slim` (etapa runtime del `Dockerfile`) no trae `ca-certificates`; nunca hizo falta hasta ahora porque la única dependencia externa era Postgres, sin TLS en este despliegue. Corregido instalando `ca-certificates` en la etapa runtime. **Segundo gap, de diseño no implementado**: `design.md` prometía loguear (server-side, nunca al cliente) los fallos de envío como mitigación, pero `issueAndSendVerificationToken` los descartaba en silencio (`_ = sender.Send(...)`) — corregido añadiendo `log.Printf` en los tres puntos de fallo posibles (generar token, persistir token, enviar email), sin loguear nunca el token en claro. **Limitación local esperada, ya anotada en `.env.example`**: el enlace real del email (`https://localhost/...`) no es alcanzable desde el navegador/cliente de correo en local (sin TLS en el puerto 443) — se verificó extrayendo el token del enlace y llamando al puerto real (`http://localhost:8080`) directamente; la URL pública de verdad solo se valida en producción (8.3).
- [x] 8.3 Desplegado desde `feature/confirmacion-email-usuarios` sin fusionar (mismo patrón que ADR-034), imagen anterior etiquetada `docker-api:pre-confirmacion-email-usuarios` para rollback. Migración `0003` aplicada sola en producción. `PUBLIC_API_BASE_URL=https://debian.taildf3dab.ts.net` (Tailscale Funnel, ya activo desde ADR-036). **Gap real encontrado, no detectable sin un proveedor externo real**: el primer intento con el remitente sandbox `onboarding@resend.dev` devolvía `200` de Resend (aceptado) pero la entrega fallaba de forma asíncrona por "Domain is not verified" — invisible para nuestro manejo de errores, que solo comprueba el status HTTP síncrono de la API (Resend no ofrece webhooks de estado de entrega en el plan usado, fuera de alcance añadirlos aquí). Resuelto verificando un dominio propio del usuario (`motor-routes.com`, comprado en Cloudflare para este propósito) en Resend y actualizando `RESEND_FROM_ADDRESS` a `no-reply@motor-routes.com` en `.env.prod`. Tras el cambio: registro real → email recibido de verdad → enlace de confirmación pulsado desde fuera del tailnet (`https://debian.taildf3dab.ts.net/...`) → página de éxito → login pasa de 403 a 200 con token válido. Verificado también que un token ya usado se rechaza (400).
- [x] 8.4 Cuenta de prueba (`gonzalocarmenado@gmail.com`, usada en 8.2 local y 8.3 producción) borrada de la base de datos de producción tras verificar — `DELETE FROM users` (cascada a `email_verification_tokens` por `ON DELETE CASCADE`), confirmado `count(*) = 0` en ambas tablas.

## 9. Cierre

- [x] 9.1 Actualizado `memory/context.md` con el resumen completo de la sesión. Nueva `memory/decisions.md::ADR-038` con las decisiones técnicas, los tres gaps reales encontrados y la verificación end-to-end en local y producción.
- [x] 9.2 Rename pendiente de `LoginRateLimiter` anotado como deuda técnica menor en ADR-038 (punto 5 de la Decisión), no hecho en este cambio.
