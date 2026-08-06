## 1. Extraer el envoltorio compartido

- [x] 1.1 Creado `apps/api/internal/auth/auth_page_layout.go`: `authPageCSS` (contenido idéntico al antiguo `resetPasswordPageCSS`) y `authPageShell(title, bodyHTML string) []byte`.
- [x] 1.2 Actualizado `reset_password_page.go`: `resetPasswordPageBodyTemplate` genera solo el contenido interior del panel; `renderResetPasswordPage` lo pasa a `authPageShell`.
- [x] 1.3 `go build ./...` limpio, suite completa de `apps/api` en verde (90/90) — confirmado que `reset_password_confirm_test.go` no necesitó tocarse (verifica comportamiento, no HTML exacto).

## 2. Estilizar la página de verificación de email

- [x] 2.1 Test rojo: el body de la respuesta de éxito (`ConfirmVerificationHandler` con token válido) contiene el marcado del panel compartido (`class="panel"`) — confirmó que era el `<p>` plano.
- [x] 2.2 Implementado en `confirm_verification.go`: `verificationSuccessHTML`/`verificationFailureHTML` reemplazadas por `verificationSuccessBody`/`verificationFailureBody` (título + párrafo) pasadas a `authPageShell`. Consolidado `writeVerificationHTML` (duplicado de `writeHTMLPage`, ya existente en `reset_password_confirm.go`) — se elimina y se reutiliza `writeHTMLPage`. Test en verde.
- [x] 2.3 Suite completa de `apps/api` en verde (90/90, incluidos los 4 tests existentes de `confirm_verification_test.go` sin tocar salvo el nuevo assert de 2.1). `go vet`/`govulncheck` limpios.

## 3. Verificación real

- [x] 3.1 `docker compose up --build` local: verificado con `curl` que tanto la página de error (`class="panel"`, `<h1>Enlace no válido</h1>`) como la de éxito llevan el marcado compartido, y confirmado visualmente por el usuario en un navegador real (ambas páginas, error y éxito) que el estilo coincide con el de reset de contraseña.

## 4. Cierre

- [x] 4.1 Actualizado `memory/context.md` con el resumen del cambio. Sin ADR nueva (refactor de presentación, no decisión de arquitectura).
