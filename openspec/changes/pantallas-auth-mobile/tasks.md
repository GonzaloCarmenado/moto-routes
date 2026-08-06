## 1. Cliente HTTP: soporte de POST

- [x] 1.1 Test rojo: `fetchJson(url, { method: 'POST', body: {...} })` envía `Content-Type: application/json` y el body serializado; sin `method`, sigue siendo `GET`.
- [x] 1.2 Ampliado `FetchJsonOptions`/`fetchJson`. **Refinamiento sobre `design.md`, decidido durante la implementación** (dos vueltas): además de `method`/`body`, `fetchJson` gana un nuevo `ExternalApiErrorKind: 'http-error'` (con `status`/`body`) y soporte de `headers` — necesario porque el cliente original nunca comprobaba `response.ok` (los `GET` existentes, stop-types/vPIC, siempre asumieron éxito implícito). Primer intento: activar la comprobación solo en `POST` — descartado al llegar a `fetchCurrentUser` (grupo 2), que es un `GET` autenticado (`Authorization: Bearer`) que también necesita distinguir 401. Solución final: flag explícito `checkStatus?: boolean` (por defecto `false`, no cambia ningún `GET` existente) en vez de inferirlo del método. Tests en verde (15/15 en `external-api.service`, 13/13 en `stop-types`+`vpic`, sin regresiones).

## 2. `auth-api.service.ts`

- [x] 2.1 Test rojo: `registerAccount` — éxito (201) devuelve id/email; 409/400 (email)/400 (password)/429 lanzan `AuthApiError` con el `kind` correspondiente.
- [x] 2.2 Test rojo: `loginAccount` — éxito (200) devuelve el token; 401/403/429 lanzan el `kind` correspondiente.
- [x] 2.3 Test rojo: `requestPasswordReset` — siempre éxito (200).
- [x] 2.4 Test rojo: `requestEmailVerification` — mismo criterio.
- [x] 2.5 Test rojo: `fetchCurrentUser` (`GET /api/auth/me` con `Authorization: Bearer`, `checkStatus: true`) — éxito devuelve `{id, email, emailVerified}`; 401 lanza `kind: 'unauthorized'`.
- [x] 2.6 Implementado `src/auth/auth-api.service.ts` cubriendo 2.1-2.5. Tests en verde (13/13).

## 3. Persistencia local de sesión

- [x] 3.1 Definidos `ISessionRepository`/`Session` (`session.repository.ts`/`session.types.ts`) + suite de contrato (`session.repository.spec.ts`, mismo patrón que `profile.repository.spec.ts`).
- [x] 3.2 Test rojo: `MemorySessionRepository` vía la suite de contrato + aislamiento entre instancias.
- [x] 3.3 Implementado `shared/repositories/memory-session.repository.ts`. Tests en verde (6/6).
- [x] 3.4 Test rojo (mock de `SqlDb`, mismo patrón que `sqlite-profile.repository.spec.ts` — no integración real, los tests de SQLite de `apps/mobile` mockean la interfaz `SqlDb`, no lo confundas con el `internal/dbtest` de Go): `SqliteSessionRepository` — tabla `session` de fila única (`CHECK (id = 1)`), `INSERT OR REPLACE`, `DELETE` en `clear()`.
- [x] 3.5 Implementado `shared/repositories/sqlite-session.repository.ts` + `sqlite-session.factory.ts`. Tests en verde (16/16 en total del grupo).

## 4. Diálogo "Crear cuenta"

- [x] 4.1-4.3 Test rojo→verde: `openRegisterDialog` — envío correcto llama a `registerAccount` y muestra el paso de éxito (mismo `data-cy` de confirmar reutilizado para "Entendido"); error `email-taken`/`weak-password` se muestra inline sin cerrar; cancelar sin enviar resuelve `'cancelled'` sin llamar a `registerAccount`.
- [x] 4.4 Implementado `auth-register-dialog.element.ts`/`.element.css` (+ `auth-dialog.element.css` compartido con los otros dos diálogos). `data-cy` según lo previsto. Tests en verde (4/4).

## 5. Diálogo "Iniciar sesión"

- [x] 5.1-5.5 Test rojo→verde: login correcto guarda sesión y resuelve `'logged-in'`; `invalid-credentials` inline sin guardar sesión; `email-not-verified` con botón de reenvío; reenvío llama a `requestEmailVerification` sin reintentar login ni cerrar; cancelar resuelve `'cancelled'`.
- [x] 5.6 Implementado `auth-login-dialog.element.ts`/`.element.css`. `data-cy` según lo previsto. **Bug real encontrado por el propio test de reenvío** (no por un test dedicado, se notó al depurar el fallo): el email/contraseña escritos se perdían al re-renderizar tras un error, porque el formulario se reconstruye desde cero y los inputs no recordaban su valor — corregido con `currentEmail`/`currentPassword` en estado (mismo patrón que `currentName` en `profile-edit-dialog`), **aplicado también al diálogo de registro** (mismo bug, no capturado por sus tests originales — añadido un test de regresión ahí también). Tests en verde (23/23 en `src/auth/`).

## 6. Diálogo "Recuperar contraseña"

- [x] 6.1-6.2 Test rojo→verde: envío llama a `requestPasswordReset` y muestra el mensaje genérico; cancelar resuelve `'cancelled'` sin llamar a la API.
- [x] 6.3 Implementado `auth-forgot-password-dialog.element.ts`/`.element.css`. `data-cy` según lo previsto. Tests en verde (25/25 en `src/auth/` en total).

## 7. Sección "Cuenta" en Perfil

- [x] 7.1-7.5 Cubierto — **refinamiento sobre `design.md`, decidido durante la implementación**: en vez de un componente `<auth-section>` con Shadow DOM propio, se separó en `auth-section.service.ts` (`loadAuthSectionState`: resuelve sesión guardada + revalidación real contra `/api/auth/me`, con test rojo→verde para los 4 casos: sin sesión, con sesión válida, 401 borra la sesión, fallo de red mantiene la sesión en caché) y `auth-section.ts` (`buildAuthSection`, render puro sin efectos) — mismo patrón ya establecido por `profile.service.ts`/`profile-header.ts`, en vez de inventar un componente nuevo para algo que se monta como sección plana dentro del propio Shadow DOM de `profile-view`.
- [x] 7.6 Implementado. **Gap real encontrado**: no había ningún punto de entrada a "recuperar contraseña" en ningún flujo — añadido un enlace `¿Olvidaste tu contraseña?` (`auth-btn-abrir-recuperar`) en el estado sin sesión, con su propio callback `onOpenForgotPassword`. `data-cy` de la sección: `auth-section-cuenta`.
- [x] 7.7 Integrado en `profile.element.ts`: setter `sessionRepository` independiente del gate `repository`+`profileRepository` (la sección "Cuenta" no depende de esos datos), `refreshAuthState()`/`handleOpenLogin`/`handleOpenRegister`/`handleOpenForgotPassword`/`handleLogout`. **Bug real encontrado y corregido durante la implementación** (no capturado por un test hasta añadir uno de regresión): tanto el diálogo de login como el de registro perdían el email/contraseña escritos al re-renderizar tras un error — corregido con estado `currentEmail`/`currentPassword` en ambos, mismo patrón que `currentName` en `profile-edit-dialog.element.ts`. Suite completa sin regresiones (868/868, `profile.element.spec.ts` incluido).

## 8. Wiring

- [x] 8.1 `app.element.ts`: instanciado `SqliteSessionRepository`/`MemorySessionRepository` (mismo patrón que `profileRepo`, incluido el fallback try/catch si el plugin SQL no está disponible), inyectado en `profile-view` vía el nuevo setter `sessionRepository`.
- [x] 8.2 `tsc --noEmit` limpio, `pnpm exec eslint src/ --max-warnings 0` limpio (corregidos `no-floating-promises` en 3 tests y `max-statements` en 3 componentes, extrayendo sub-builders). Suite Vitest completa en verde (868/868, 93/93 ficheros), cobertura 96.17% líneas / 90.74% ramas / 94.11% funciones (umbral 80%). **Gap de configuración encontrado**: el nuevo fichero de contrato `session.repository.spec.ts` (mismo patrón que `profile.repository.spec.ts` — exporta una función, no un `describe` propio) no estaba en las listas de exclusión de `vitest.config.ts`, rompiendo la suite con "No test suite found" — añadido a ambas listas (`test.exclude` y `coverage.exclude`, junto con `session.types.ts`/`session.repository.ts` como contratos puros sin código ejecutable).

## 9. Verificación E2E real

- [x] 9.1 Nuevo `cypress/e2e/auth/auth.cy.ts`, backend real (mismo patrón que `cockpit-mark-stop.cy.ts`, sin mocks de `apps/api`):
  - Registro con email duplicado → error inline.
  - Registro con contraseña débil → error inline.
  - Login con credenciales incorrectas → error genérico.
  - Registro real seguido de login inmediato → rechazado por email sin verificar, con botón de reenvío funcional.
  - Login correcto tras sembrar `email_verified = true` por SQL directo (`cy.exec`, ver `design.md`) → sesión guardada, Perfil muestra el email.
  - Cerrar sesión → vuelve al estado "sin sesión".
  - Recuperar contraseña con cualquier email → mensaje genérico de confirmación.

  **Gap real encontrado en la primera ejecución contra un navegador de verdad** (invisible en toda la verificación manual previa, hecha con `curl` y páginas server-rendered same-origin): `POST /api/auth/register`, `/login`, `/verify-email/request`, `/reset-password/request` y `GET /api/auth/me` no tenían cabeceras CORS — a diferencia de `GET /api/stop-types` (ADR-035), nunca se habían llamado desde `fetch()` cross-origin (`localhost:1420` → `localhost:8080`) hasta este spec. `httpmw.PublicCORS` original solo ponía `Access-Control-Allow-Origin`, sin responder al preflight `OPTIONS` ni declarar `Access-Control-Allow-Methods`/`Headers`. Corregido reescribiendo `PublicCORS` (2 tests nuevos en `cors_test.go`, 6/6 en verde) y añadiendo `.With(httpmw.PublicCORS)` + rutas `OPTIONS` explícitas a los 5 endpoints en `cmd/api/main.go`. Esta corrección toca `apps/api` ya mergeado en `master`, no algo introducido por esta rama.

  **Segundo hallazgo, en mi propio test**: 3 de los 6 casos hacían doble click sobre `auth-btn-confirmar-registro` (uno para enviar el registro, otro para cerrar el paso de éxito) sin esperar a que el diálogo transicionara de paso — condición de carrera que a veces disparaba un registro duplicado en vez de cerrar. Corregido intercalando `cy.get(...).should('contain', 'verifica tu cuenta')` entre ambos clicks.

  **Tercer hallazgo, también en mi propio test**: el escenario original aseveraba que la sesión persistía tras `cy.reload()` (SQLite) — no verificable así, porque Cypress corre en un navegador normal (no el WebView de Tauri), `isTauri()` da siempre `false`, y `app.element.ts` usa `MemorySessionRepository` (nueva instancia vacía en cada recarga). Mismo motivo por el que ningún otro spec de Cypress (rutas, perfil) prueba persistencia SQLite tras recargar. Eliminada esa aserción del spec; la persistencia real se verifica en dispositivo (grupo 10).
- [x] 9.2 Cuenta(s) de prueba usadas en el test limpiadas de la base de datos al final del spec (`cy.exec` con `DELETE FROM users WHERE email LIKE 'cypress-auth-%'`, mismo criterio que la limpieza manual ya seguida en producción). Confirmado `0 rows` tras la ejecución.
- [x] 9.3 `pnpm run test:e2e` completo (8 specs, no solo el nuevo) en verde local: 47/47 (6 del nuevo `auth.cy.ts` + 41 ya existentes, sin regresiones). Mismo mecanismo de `ci.yml::quality-ts` ya usado por `cockpit-mark-stop.cy.ts`.

## 10. Verificación real en dispositivo

- [ ] 10.1 Build local por USB (gotchas ya documentados en `memory/context.md`: `JAVA_HOME` a `jdk-24`, sync de assets antes de reempaquetar). Registro, login, login sin verificar + reenvío, recuperación de contraseña, cierre de sesión — cada uno probado a mano en el dispositivo real, confirmando que la app sigue funcionando con y sin sesión (cockpit/rutas sin cambios).

## 11. Cierre

- [ ] 11.1 Actualizar `memory/context.md` con el estado del cambio.
- [ ] 11.2 Nueva ADR en `memory/decisions.md` si el cambio confirma alguna decisión de arquitectura nueva (dominio `src/auth/`, extensión de `fetchJson`, patrón de sembrado SQL en Cypress).
