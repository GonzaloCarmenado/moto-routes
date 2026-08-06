## Why

`apps/api` ya permite registrarse e iniciar sesión (`apps/api/internal/auth/register.go`, `login.go`, `token.go`) desde la migración a Go (ADR-034), pero cualquiera puede crear una cuenta con un email que no controla — no hay forma de comprobar que el usuario real es dueño de ese buzón. Antes de exponer la API más allá del dispositivo del propio desarrollador, hace falta confirmación de email para evitar cuentas con emails falsos o ajenos.

## What Changes

- Nueva columna `email_verified` (boolean, `false` por defecto) en `users`.
- Nueva tabla de tokens de verificación de un solo uso, ligados a un usuario, con expiración.
- Nuevo endpoint `POST /api/auth/verify-email/request` — solicita (o reenvía) un email de verificación para una cuenta ya registrada. Responde igual exista o no la cuenta, para no permitir enumeración.
- Nuevo endpoint que confirma el token recibido por email y marca la cuenta como verificada — método HTTP concreto decidido en `design.md` (el email es un enlace clicable, no hay frontend todavía para introducir el token a mano).
- `RegisterHandler` dispara el envío del primer email de verificación tras crear la cuenta (best-effort: si el envío falla, la cuenta se crea igualmente; el usuario puede pedir un reenvío).
- Envío de correo real vía **Resend** (API REST, sin SDK nuevo — ver Impact), clave de API solo por variable de entorno.
- **BREAKING**: `LoginHandler` pasa a rechazar el login de una cuenta con `email_verified = false`, aunque el email y la contraseña sean correctos. Decisión tomada explícitamente con el usuario: prioriza evitar cuentas fantasma sobre mantener el comportamiento actual de login.

Fuera de alcance de este cambio (decisiones ya tomadas con el usuario): reset de contraseña (spec aparte más adelante) y cualquier UI de frontend — el registro solo backend.

## Capabilities

### New Capabilities
- `email-verification`: emisión, envío y confirmación de tokens de verificación de email de un solo uso, y el estado `email_verified` de una cuenta.

### Modified Capabilities
- `user-auth`: el requisito "Login emite un token de sesión válido" cambia — deja de bastar con email+contraseña correctos; una cuenta sin verificar es rechazada aunque las credenciales sean correctas.

## Impact

- **Código afectado**: `apps/api/internal/auth/` (nuevo `verify_email.go` o similar, `login.go` modificado, `register.go` modificado, `user.go`/`postgres_store.go` para el campo `email_verified`), nueva migración en `apps/api/internal/migrate/migrations/` (tras `0002_create_stop_types.sql`), `apps/api/cmd/api/main.go` (wiring de las dos rutas nuevas y del cliente de Resend), `apps/api/internal/config/` (nueva variable de entorno para la API key de Resend y para la URL base pública usada en el enlace del email).
- **Infraestructura**: nuevo secreto `RESEND_API_KEY` — vía GitHub Secrets en CI/release y `infra/docker/.env.prod` (no versionado) en el servidor, mismo patrón que `AUTH_TOKEN_SECRET`.
- **Dependencias**: ninguna nueva por defecto — se llama a la API REST de Resend (`https://api.resend.com/emails`) con `net/http` de la librería estándar, siguiendo la regla del proyecto de preferir API nativa antes que añadir un paquete. Se confirma como decisión de diseño en `design.md`.
- **Spec existente afectada**: `openspec/specs/user-auth/spec.md`, escenario de login — necesita un delta que documente el nuevo caso "cuenta sin verificar".
