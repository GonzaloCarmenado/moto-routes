# Review: pantallas-auth-mobile

## CRÍTICO — leer primero

**Seguridad**: este cambio es 100% frontend (`apps/mobile`) sobre endpoints de `apps/api` ya implementados y ya auditados en `confirmacion-email-usuarios` (ADR-038) y `reset-contrasena` (ADR-039) — no introduce criptografía, rate limiting ni lógica de tokens nueva.
- **Sesión almacenada como el propio backend la emite**: el JWT (`token`) se guarda tal cual en `ISessionRepository` (SQLite/memoria), sin decodificarlo ni volver a firmarlo en el cliente.
- **Sin enumeración añadida en el cliente**: `auth-login-dialog` usa el mismo mensaje genérico para `invalid-credentials` (contraseña incorrecta o email inexistente, indistinguibles) — coherente con que el propio backend ya responde igual en ambos casos. `auth-forgot-password-dialog` siempre muestra el mismo mensaje de confirmación, nunca revela si la cuenta existe.
- **Revalidación real, no solo confianza en el token local**: `loadAuthSectionState` llama a `GET /api/auth/me` en cada carga de Perfil; solo borra la sesión guardada en un 401 confirmado por el servidor, nunca por un fallo de red (evita cerrar sesión por estar offline).
- **Sin secretos reales en el diff**: verificado con `git log -p master..feature/pantallas-auth-mobile` buscando el patrón de la API key real de Resend y de tokens de sesión reales usados durante la verificación manual — cero coincidencias.
- **Gap real de CORS encontrado por este mismo cambio, ya corregido y mergeado por separado** (PR #104, `apps/api` — no es código de esta rama): `httpmw.PublicCORS` no respondía al preflight `OPTIONS` en los endpoints de auth. Sin este fix, ninguno de los flujos de este cambio funcionaría desde un navegador/WebView real. Verificado ya fusionado a `master` y traído a esta rama sin conflictos (diff idéntico).

**Cambios en `src/shared/`**: `external-api.service.ts` (extensión de `fetchJson` con `method`/`headers`/`checkStatus`) y `session.repository.ts`/`session.types.ts`/`memory-session.repository.ts`/`sqlite-session.repository.ts`/`sqlite-session.factory.ts` (dominio de sesión, nuevo). Todo con tests de contrato propios, mismo patrón que `profile.repository.ts`.

**Actualizaciones de dependencias core**: ninguna.

**Reglas del proyecto saltadas**: ninguna. `data-cy` en todo elemento interactivo nuevo, sin CSS inline, sin hardcodear tokens de color/espaciado (confirmado en la revisión de `profile.element.css`/`auth-*.css` — todo vía `var(--token)`).

## Cobertura de Requirement/Scenario

### `specs/mobile-auth-screens/spec.md` (capability nueva)

| Requirement | Scenario | Test |
|---|---|---|
| Perfil muestra estado de sesión | Sin sesión guardada | `auth-section.spec.ts::'sin sesión, muestra los botones...'` + `auth.cy.ts` (todos los escenarios parten de este estado) |
| Perfil muestra estado de sesión | Con sesión guardada y válida | `auth-section.service.spec.ts::'con sesión guardada y válida, devuelve logged-in...'` + `auth.cy.ts::'login correcto...'` |
| Perfil muestra estado de sesión | Con sesión guardada pero ya no válida | `auth-section.service.spec.ts::'con sesión guardada pero ya no válida (401), borra la sesión local...'` |
| Crear cuenta | Registro correcto | `auth-register-dialog.element.spec.ts::'envío correcto llama a registerAccount...'` + `auth.cy.ts::'registro real seguido de login...'` |
| Crear cuenta | Registro rechazado por email ya existente | `auth-register-dialog.element.spec.ts::'error email-taken...'` + `auth.cy.ts::'registro rechazado por email ya existente'` |
| Crear cuenta | Registro rechazado por contraseña débil | `auth-register-dialog.element.spec.ts::'error weak-password...'` + `auth.cy.ts::'registro rechazado por contraseña débil...'` |
| Iniciar sesión | Login correcto | `auth-login-dialog.element.spec.ts::'login correcto guarda la sesión...'` + `auth.cy.ts::'login correcto (cuenta verificada por SQL)...'` |
| Iniciar sesión | Login rechazado por credenciales incorrectas | `auth-login-dialog.element.spec.ts::'error invalid-credentials...'` + `auth.cy.ts::'login rechazado por credenciales incorrectas'` |
| Iniciar sesión | Login rechazado por email sin verificar | `auth-login-dialog.element.spec.ts::'error email-not-verified...'` + `auth.cy.ts::'registro real seguido de login rechazado por email sin verificar...'` |
| Iniciar sesión | Reenviar verificación desde el error de login | `auth-login-dialog.element.spec.ts::'pulsar "Reenviar email de verificación"...'` + mismo test de `auth.cy.ts` |
| Recuperar contraseña | Solicitud de recuperación | `auth-forgot-password-dialog.element.spec.ts::'envío llama a requestPasswordReset...'` + `auth.cy.ts::'recuperar contraseña muestra el mensaje genérico...'` |
| Cerrar sesión | Cerrar sesión | `auth-section.spec.ts::'con sesión, muestra el email y el botón de cerrar sesión'` + `auth.cy.ts::'...cerrar sesión vuelve al estado inicial'` |
| Resto de la app funciona igual con/sin sesión | Cockpit funciona sin sesión activa | `cockpit.cy.ts`/`cockpit-mark-stop.cy.ts` (8+2 escenarios, ninguno inyecta `sessionRepository` ni depende de sesión — pasan igual antes y después de este cambio) |

**Cobertura automatizada: 13/13 escenarios (100%).**

**Verificación manual (requiere dispositivo real y servicios externos, no solo tests)**:
- Los 5 escenarios completos probados a mano en dispositivo Android real (Realme `75fe536b`): registro, login sin verificar + reenvío, verificación de email + login, recuperar contraseña, cerrar sesión. Estado: **hecho** — detalle de los tres gaps de conectividad encontrados (ninguno bug de la app) en `tasks.md` grupo 10.
- Build "como la release" (mismo comando y parche de CSP que `ci.yml::build-and-release`), verificado con el mismo chequeo de hash de frontend y de CSP horneado que usa CI antes de instalar. Estado: **hecho**.
- Cuentas de prueba usadas durante la verificación manual borradas de la base de datos local. Estado: **hecho**.
- Suite completa repetida tras traer `master` (con el fix de CORS ya mergeado): `go build`/`vet`/`test` (72/72), `tsc`/ESLint limpios, Vitest 868/868, Cypress 47/47 (8 specs, incluyendo los 6 de `auth.cy.ts`). Estado: **hecho**, sin regresiones.

## Otros hallazgos (no bloqueantes)

- **[Diseño, no bloqueante]** Rediseño posterior a la implementación original: la sección "Cuenta" pasó de ser un bloque independiente al final de Perfil a integrarse en una tarjeta única con el avatar/nombre (`buildIdentityCard`, "Identidad unificada" — una de tres propuestas visuales exploradas y aprobadas por el usuario). Mismos `data-cy`, mismo comportamiento — solo estructura/estilo. 134/134 tests de `profile`+`auth` en verde tras el cambio, sin necesidad de nuevos tests (comportamiento idéntico).
- **[Deuda ya documentada, no de este cambio]** La verificación por Cypress no puede probar la persistencia de sesión en SQLite tras recargar, porque Cypress corre en un navegador normal (no el WebView de Tauri) y `isTauri()` da siempre `false` — mismo motivo por el que ningún otro spec de Cypress prueba persistencia SQLite. La persistencia real solo se verifica en dispositivo (grupo 10), donde sí se confirmó.

## Veredicto

**APPROVED**

Los 13 escenarios de la spec nueva tienen cobertura automatizada 1:1 (unitaria + E2E con backend real), más los 5 escenarios completos verificados a mano en dispositivo Android real. El gap de CORS que este cambio destapó ya está corregido y fusionado por separado (PR #104), y esta rama lo absorbió sin conflictos. Sin secretos reales en el diff, sin criptografía ni lógica de auth nueva en el cliente (reutiliza lo ya auditado en ADR-038/039), sin dependencias nuevas. El único hallazgo es un rediseño visual posterior ya cubierto por la suite existente sin regresiones.
