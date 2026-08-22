## 1. Backend: modelo y migración

- [x] 1.1 Migración `000N_add_users_username.sql`: `ALTER TABLE users ADD COLUMN username TEXT;` + `CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));` (ver design.md, Decisión 1).
- [x] 1.2 Test rojo en `user_test.go` (o fichero nuevo si no existe): `validateUsername()` acepta minúsculas/dígitos/guion bajo entre 3-20 caracteres, rechaza fuera de rango y caracteres no permitidos (ver design.md, Decisión 6).
- [x] 1.3 Implementar `validateUsername()` en `user.go` hasta verde. Añadir `Username *string` a `StoredUser`, `ErrUsernameTaken`/`ErrInvalidUsername` (mismo patrón que `ErrEmailTaken`/`ErrInvalidEmail`).
- [x] 1.4 Test rojo (integración real contra Postgres, `internal/dbtest`) en `postgres_store_test.go`: `CreateUser` con username duplicado (sin distinguir mayúsculas) devuelve `ErrUsernameTaken`; con username disponible, la cuenta queda creada con él.
- [x] 1.5 Implementar en `postgres_store.go` hasta verde: `CreateUser` exige `username` y traduce la violación del índice único (`uniqueViolationCode`) a `ErrUsernameTaken`, distinguiéndola de `ErrEmailTaken` (mirar qué constraint violó).

## 2. Backend: el registro exige username

- [x] 2.1 Test rojo en `register_test.go`: `RegisterHandler` rechaza username vacío/formato inválido (400) y username ya en uso (409, `ErrUsernameTaken`), sin crear la cuenta en ninguno de los dos casos.
- [x] 2.2 Test rojo: registro con username válido y disponible crea la cuenta con él y lo devuelve en `registerResponse`.
- [x] 2.3 Implementar hasta verde: `registerRequest`/`registerResponse` ganan `username`, `RegisterHandler` valida formato antes de llamar a `store.CreateUser`.

## 3. Backend: fijar/editar username y exponerlo en `/me`

- [x] 3.1 Test rojo: `UpdateUsername(ctx, userID, username)` en `UserStore`/`PostgresUserStore` (integración real) — éxito, username ya en uso por otra cuenta (`ErrUsernameTaken`), formato inválido (`ErrInvalidUsername`).
- [x] 3.2 Implementar `UpdateUsername` hasta verde, mismo criterio de traducción de la constraint que `CreateUser` (1.5).
- [x] 3.3 Test rojo: `PATCH /api/auth/username` (nuevo handler) — 200 con username válido y disponible (funciona igual con la cuenta sin username previo que con una que ya lo tenía, ver design.md Decisión 2), 400 formato inválido, 409 ya en uso, 401 sin sesión.
- [x] 3.4 Implementar `UsernameHandler`/`RateLimitedUsernameHandler` (nueva instancia de `LoginRateLimiter` keyed por `userID`, mismo patrón que `RateLimitedRegisterHandler`) hasta verde. Registrar la ruta en `main.go`.
- [x] 3.5 Test rojo en `me_test.go`: `meResponse` incluye `username` (`null` si la cuenta no lo tiene fijado, el valor si lo tiene).
- [x] 3.6 Implementar hasta verde.

## 4. Frontend: tipos, servicio y registro

- [x] 4.1 Test rojo en `auth-api.service.spec.ts`: `CurrentUser`/`fetchCurrentUser` mapean `username` (`string | null`); `registerAccount` (o como se llame hoy) envía `username` en el body.
- [x] 4.2 Implementar hasta verde. Añadir `setUsername(apiBaseUrl, token, username)` nuevo (`PATCH /api/auth/username`), con su propio error tipado siguiendo el patrón ya usado (`kind: 'invalid-format' | 'taken' | 'unauthorized' | 'network' | 'unknown'`).
- [x] 4.3 Test rojo en `auth-register-dialog.element.spec.ts`: el formulario de registro incluye el campo de username (`data-cy="auth-input-username-registro"`), lo envía, y muestra el error si el backend lo rechaza (formato o ya en uso) sin cerrar el diálogo.
- [x] 4.4 Implementar hasta verde.

## 5. Frontend: componente de formulario de username (compartido) y bloqueo de cuentas existentes

- [x] 5.1 Test rojo en un spec nuevo (`username-form.element.spec.ts`): componente `<username-form>` — arranca vacío o con `currentUsername` prellenado, valida formato en cliente antes de llamar al backend (sin llamar si está vacío o mal formado), llama a `setUsername` y despacha `USERNAME_FORM_SUCCESS_EVENT` en éxito, muestra el error del backend si falla, nunca incluye botón de cancelar (ver design.md, Decisión 5).
- [x] 5.2 Implementar `<username-form>` hasta verde (7/7 tests).
- [x] 5.3-5.6 **Desviación de lo planeado, documentada aquí**: `app.element.ts` no tiene ningún `*.spec.ts` en todo el proyecto (está explícitamente excluido de cobertura en `vitest.config.ts`) — su comportamiento se verifica siempre vía Cypress real, nunca con Vitest. Escribir un spec nuevo solo para este cambio habría ido contra esa convención ya establecida. Los 4 escenarios (bloqueo con `username: null`, restaurar acceso al fijarlo, sin bloqueo si ya tiene username o sin sesión, fallo de red no bloquea) se verifican en el Grupo 7 (Cypress) en su lugar — ver tareas 7.2.
- [x] 5.7 Implementar la vista `username-gate` en `app.element.ts` hasta verde (séptima vista del sistema `showView()` ya existente, sin router nuevo) — construida bajo demanda en `init()` tras `GET /api/auth/me`, no en el `render()` inicial (a diferencia del resto de vistas, que no dependen de datos async).

## 6. Frontend: editar el username desde Perfil

- [x] 6.1 Test rojo en `profile.element.spec.ts` (o donde viva la sección de cuenta): con sesión activa, Perfil muestra el username actual y una acción para editarlo, abriendo el formulario compartido (Grupo 5) en un diálogo descartable.
- [x] 6.2 Test rojo: guardar un username disponible desde el diálogo lo actualiza y se refleja de inmediato en Perfil.
- [x] 6.3 Test rojo: guardar un username ya en uso muestra el error sin cerrar el diálogo ni cambiar el username mostrado.
- [x] 6.4 Test rojo: intentar guardar vacío se rechaza en cliente, sin llamar al backend.
- [x] 6.5 Implementar hasta verde. `<username-edit-dialog>` (nuevo, `apps/mobile/src/auth/`) envuelve `<username-form>` con overlay/título/Cancelar; `AuthSectionState` gana `username: string | null`; `auth-section.ts` muestra el username + acción "Editar"/"Fijar" (`data-cy="auth-btn-editar-username"`). La lógica de cuenta de `profile.element.ts` (antes inline) se extrajo a `profile-account.ts` (`ProfileAccountController`) por límite de líneas del proyecto — excepción documentada, ver CLAUDE.md. 195/195 tests de `src/profile/`+`src/auth/` en verde; suite completa 1266/1266; `tsc`/`eslint --max-warnings 0` limpios.

## 7. E2E y verificación real

- [x] 7.1 Cypress nuevo (`username.cy.ts` o similar): registro completo con username, login posterior sin bloqueo.
- [x] 7.2 Cypress: una cuenta sembrada vía API sin username (simulando una cuenta preexistente a la migración) queda bloqueada al iniciar sesión por UI, y fijar uno disponible restaura el acceso.
- [x] 7.3 Cypress: editar el username desde Perfil, éxito y rechazo por username ya en uso.
- [x] 7.4 Verificación manual en dispositivo Android real: aplicar la migración contra el Postgres local (o Docker), confirmar que una cuenta de prueba ya existente (p. ej. `prueba@prueba.com`) queda bloqueada al iniciar sesión, fijar su username, y confirmar acceso normal después.

## 8. Cierre

- [x] 8.1 Suite completa en verde: Go (`go test ./...`, `govulncheck`, `gofmt`, `go vet`), `tsc --noEmit`, `eslint --max-warnings 0`, `vitest run --coverage` (≥80%), Cypress contra backend real.
- [x] 8.2 Sincronizar la spec `user-auth` (delta de este cambio) a `openspec/specs/`.
- [x] 8.3 Actualizar `memory/context.md` (Estado Actual del Proyecto) con el resumen de la sesión.
