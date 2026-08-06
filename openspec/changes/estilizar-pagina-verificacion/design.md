## Context

Ver `proposal.md` — motivación. `reset_password_page.go` (de `reset-contrasena`, ADR-039) ya tiene el CSS "Asfalto Nocturno" completo (colores `oklch()` copiados de `tokens.css`, tipografía con *fallback stacks*) y una plantilla `html/template` con un panel centrado. `confirm_verification.go` sirve hoy `verificationSuccessHTML`/`verificationFailureHTML`, dos constantes `<p>` sin ningún estilo, escritas directamente con `w.Write([]byte(...))`.

## Goals / Non-Goals

**Goals:**
- La página de verificación de email se ve visualmente igual de cuidada que la de reset de contraseña.
- El CSS no queda duplicado entre las dos páginas.

**Non-Goals:**
- Cambiar ningún comportamiento observable (status codes, condiciones de éxito/error) — ver `proposal.md`.
- Tocar la página de reset de contraseña más allá de extraer lo compartido — su comportamiento y su HTML final no cambian.
- Crear un sistema de plantillas genérico para futuras páginas no previstas — solo se extrae lo que ya existe y se necesita ahora mismo.

## Decisions

### Extraer el CSS y el envoltorio (`<html>`/`<head>`/`.panel`) a un fichero compartido, no una plantilla genérica con muchos parámetros
Nuevo `apps/api/internal/auth/auth_page_layout.go`: constante `authPageCSS` (renombrada desde `resetPasswordPageCSS`, contenido idéntico) y una función `authPageShell(title, bodyHTML string) []byte` que envuelve `<!doctype html>...<style>{{CSS}}</style>...<div class="panel">{bodyHTML}</div>...`. Cada página (reset, verificación) construye su propio fragmento interior (formulario, mensaje de éxito, mensaje de error) y se lo pasa a `authPageShell` — evita una plantilla única con muchos campos opcionales (`ShowForm`/`Success`/`Token`/...) que tendría que servir a la vez dos páginas con formas distintas de contenido.

### `reset_password_page.go` pasa a usar `authPageShell` en vez de tener su propio `<html>` completo
La plantilla `resetPasswordPageTemplate` deja de incluir `<!doctype html>`/`<style>` — solo genera el contenido del panel (formulario/éxito/inválido), que se pasa a `authPageShell`. Mismo comportamiento, mismo HTML final (verificado byte a byte por los tests existentes de `reset_password_confirm_test.go`, que no deben tener que cambiar).

### La página de verificación usa `html/template`, no las constantes `<p>` literales actuales
`confirm_verification.go` gana una plantilla mínima (título + párrafo, variante éxito/error) análoga a la de reset, usando `authPageShell`. Mismo criterio de seguridad ya aplicado en `reset-contrasena`: `html/template` auto-escapa, aunque hoy no se interpola ningún valor dinámico en estos mensajes (son literales fijos).

## Risks / Trade-offs

- **[Riesgo] Cambiar el HTML de la página de verificación podría romper algo que dependa del texto exacto del `<p>` actual** — revisado: nada en `apps/mobile` ni en ningún test parsea el HTML de esta página (el usuario solo la ve en el navegador tras pulsar el enlace del email), así que no hay contrato roto. Los tests de `confirm_verification_test.go` verifican status code y presencia del token en el caso de éxito de `request`, no el contenido exacto de esta página — se revisan igualmente para confirmarlo antes de dar el cambio por cerrado.
