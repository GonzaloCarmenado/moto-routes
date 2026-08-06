## Why

`GET /api/auth/verify-email/confirm` responde hoy con un `<p>` sin estilo (`verificationFailureHTML`/`verificationSuccessHTML` en `confirm_verification.go`), mientras que la página equivalente de reset de contraseña (`reset-contrasena`, ADR-039) ya lleva el diseño "Asfalto Nocturno" completo. Es la página que ve un usuario real al confirmar su cuenta — dejarla en texto plano mientras la de al lado está cuidada es inconsistente y da mala primera impresión.

## What Changes

- La página de confirmación de verificación de email (éxito y error) pasa a usar el mismo estilo visual que la de reset de contraseña.
- El CSS/plantilla ya escrito en `reset_password_page.go` se extrae a un fichero compartido entre ambas páginas, en vez de duplicarlo — mismo criterio de "no reinventar" ya aplicado con `generateOneTimeToken`/`hashOneTimeToken` en `reset-contrasena`.
- **Sin cambios de comportamiento observable**: los mismos códigos de estado y condiciones de éxito/error ya definidos en la spec `email-verification` siguen exactamente igual — solo cambia el HTML que se sirve en el `body` de la respuesta. `skip_specs: true` porque ningún `Requirement`/`Scenario` cambia.

## Capabilities

Ninguna — cambio puramente de presentación, sin comportamiento nuevo (`skip_specs: true`).

## Impact

- **Código afectado**: `apps/api/internal/auth/confirm_verification.go` (usa la plantilla compartida en vez de los `<p>` literales), `apps/api/internal/auth/reset_password_page.go` (se extrae la parte compartida a un fichero nuevo, p. ej. `page_layout.go`), tests existentes de `confirm_verification_test.go` (siguen verificando status/contenido semántico, no el HTML exacto).
- **Sin dependencias nuevas, sin variables de entorno nuevas.**
- **Specs no afectadas**: `email-verification` no cambia ningún `Requirement`/`Scenario`.
