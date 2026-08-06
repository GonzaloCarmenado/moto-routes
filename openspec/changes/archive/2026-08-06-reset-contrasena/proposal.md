## Why

`apps/api` ya permite verificar el email (`confirmacion-email-usuarios`, ADR-038), pero un usuario que olvida su contraseña no tiene ninguna forma de recuperarla — hoy la única opción sería crear una cuenta nueva. Es la pieza que quedó explícitamente aparcada en la sesión de confirmación de email ("sin reset de contraseña todavía, spec aparte más adelante").

## What Changes

- Nuevo endpoint `POST /api/auth/reset-password/request` — solicita un reset indicando solo el email. Responde igual exista o no la cuenta, mismo criterio anti-enumeración que `verify-email/request`.
- Nuevo token de reset de un solo uso, mismo mecanismo que el de verificación de email (`crypto/rand` + hash), en una tabla propia (un token de reset y uno de verificación no son intercambiables).
- Nuevo `GET /api/auth/reset-password/confirm?token=...` — sirve una **página web real con formulario** (contraseña nueva + confirmación) para escribir la contraseña, servida directamente por `apps/api` (no hay frontend de app para esto, igual que la confirmación de email). A diferencia de la página de verificación (un párrafo sin estilo), esta sí lleva el diseño "Asfalto Nocturno" del proyecto porque necesita ser usable de verdad — decisión ya tomada con el usuario.
- `POST /api/auth/reset-password/confirm` (envío del formulario) — valida el token, la política mínima de contraseña, que ambos campos coincidan, y sustituye el hash de contraseña. Si la cuenta no tenía el email verificado, completar un reset la marca como verificada (ya demostró controlar ese email).
- Rate limiting en la solicitud de reset, mismo patrón que los otros endpoints de auth.

Fuera de alcance (confirmado con el usuario): estilizar el resto de páginas ya existentes (verificación de email, "cuenta creada"...) — eso es el siguiente cambio de frontend. Tampoco se invalidan sesiones JWT ya emitidas al cambiar la contraseña (sin infraestructura de revocación de tokens hoy, ver `design.md`).

## Capabilities

### New Capabilities
- `password-reset`: solicitud, token de un solo uso, y confirmación con formulario web real para establecer una contraseña nueva.

## Impact

- **Código afectado**: `apps/api/internal/auth/` (nuevo `reset_token.go`/`reset_token_store.go` o reutilización del patrón de `verification_token.go` con una tabla propia, nuevo handler de solicitud y de confirmación con render HTML+form), nueva migración en `apps/api/internal/migrate/migrations/` (tras `0003_add_email_verification.sql`), `apps/api/cmd/api/main.go` (wiring de las dos rutas nuevas).
- **Sin nueva variable de entorno**: reutiliza `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`/`PUBLIC_API_BASE_URL` ya existentes.
- **Sin dependencias nuevas**: el formulario es HTML estándar (`application/x-www-form-urlencoded`), sin JavaScript; los colores de "Asfalto Nocturno" se referencian directamente como CSS embebido en el HTML servido por Go (los valores `oklch()` de `tokens.css`), sin importar el fichero real de `apps/mobile` (paquetes distintos, sin pipeline de build compartido) ni instalar un motor de plantillas nuevo.
- **Spec existente no afectada**: no modifica `user-auth` ni `email-verification`, capability nueva y aislada.
