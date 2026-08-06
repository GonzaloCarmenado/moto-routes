## Context

Ver `proposal.md` — motivación. `apps/api` ya expone `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/verify-email/request` y `POST /api/auth/reset-password/request` (ADR-034/038/039), todos verificados en producción. `apps/mobile` sigue el patrón de dominio por carpeta (`src/cockpit/`, `src/routes/`, `src/profile/`), diálogos como `openXDialog(options): Promise<'saved' | 'cancelled'>` (`profile-edit-dialog.element.ts`), repositorios SQLite de fila única para datos sin multi-usuario (`sqlite-profile.repository.ts`, tabla `profile` con `CHECK (id = 1)`), y `fetchJson<T>(url, options?)` (`shared/http/external-api.service.ts`) como único cliente HTTP genérico — hoy solo soporta `GET`.

## Goals / Non-Goals

**Goals:**
- Registro, login, recuperación de contraseña y logout funcionando desde Perfil, con sesión persistida localmente.
- Reutilizar al máximo lo ya existente: `fetchJson`, el patrón de diálogo, el patrón de repositorio SQLite de fila única, `getApiBaseUrl()`.

**Non-Goals:**
- Gating de la app (exigir sesión para cockpit/rutas) — spec aparte, ver `proposal.md`.
- Pantalla de confirmación de reset de contraseña dentro de la app — ya existe como página web servida por `apps/api` (`reset-contrasena`, ADR-039), fuera del alcance de este cambio.
- Editar email o contraseña de una cuenta ya logueada (fuera de "recuperar contraseña olvidada") — no hay endpoint de `apps/api` para eso todavía.

## Decisions

### Dominio nuevo `apps/mobile/src/auth/`, entrada montada dentro de Perfil
Cuatro componentes nuevos siguiendo el patrón ya establecido (Web Component + Shadow DOM + `*.element.css` + servicio separado):
- `auth-section.element.ts` — sección "Cuenta" renderizada dentro de `profile.element.ts` (nueva llamada a `section.appendChild(buildAuthSection(...))`, mismo patrón que `buildHeaderSection()`/`buildVehicleSection()`). Muestra el estado de sesión y abre los diálogos.
- `auth-login-dialog.element.ts` / `openLoginDialog(deps): Promise<'logged-in' | 'cancelled'>`
- `auth-register-dialog.element.ts` / `openRegisterDialog(deps): Promise<'registered' | 'cancelled'>`
- `auth-forgot-password-dialog.element.ts` / `openForgotPasswordDialog(deps): Promise<'sent' | 'cancelled'>`

Los tres diálogos comparten el mismo *shell* de `<confirm-dialog>` (overlay + panel) donde ya existe, o replican el patrón visual de `profile-edit-dialog` si `<confirm-dialog>` no encaja con un formulario multi-campo — decisión de implementación concreta al escribir el código, no bloquea el diseño.

### `fetchJson` gana soporte de `method`/`body`, no una función nueva paralela
`FetchJsonOptions` se amplía con `method?: 'GET' | 'POST'` (por defecto `'GET'`, así ningún call-site existente cambia) y `body?: unknown` (serializado a JSON, con `Content-Type: application/json`). Se descarta una función `postJson` separada — sería duplicar el manejo de timeout/`AbortController`/errores tipados que `fetchJson` ya resuelve bien, por una diferencia que es solo el método HTTP.

### Nuevo `IAuthApiService` (o funciones sueltas) en `src/auth/auth-api.service.ts`
Envuelve las cuatro llamadas (`registerAccount`, `loginAccount`, `requestPasswordReset`, `requestEmailVerification`) sobre `fetchJson` ampliado, con tipos de error propios (`AuthApiError` con `kind: 'invalid-credentials' | 'email-not-verified' | 'email-taken' | 'weak-password' | 'rate-limited' | 'network' | ...`) mapeados desde el status code HTTP de la respuesta de `apps/api` — igual que `ExternalApiError.kind` ya distingue causas para que cada consumidor decida cómo reaccionar.

### Sesión persistida en una tabla de fila única, mismo patrón que `profile`
Nueva `ISessionRepository` (`shared/models/session.repository.ts`): `get(): Promise<Session | null>`, `save(session: Session): Promise<void>`, `clear(): Promise<void>`. `Session = { token: string; email: string }`. `SqliteSessionRepository` — tabla `session` con `CHECK (id = 1)`, idéntica forma a `profile`. `MemorySessionRepository` para tests, siguiendo `memory-profile.repository.ts`. Wiring en `app.element.ts` idéntico al de `profileRepo` (`sessionRepo: ISessionRepository`, setter `session.repository = this.sessionRepo` — o se inyecta directamente en `profile-view` como una prop más, ya que la sección vive ahí).

### Revalidación contra `GET /api/auth/me` al abrir Perfil, no confiar ciegamente en la sesión guardada
`auth-section.element.ts` llama a `/api/auth/me` con el token guardado al montar; si responde `401`, borra la sesión local (`sessionRepo.clear()`) y renderiza el estado "sin sesión". Evita mostrar un email obsoleto de una sesión ya revocada/expirada — mismo espíritu que `refreshStopTypesCache` revalidando contra el backend real en vez de confiar solo en la caché.

### Verificación E2E con Cypress: backend real (mismo patrón que `cockpit-mark-stop.cy.ts`), con un paso de sembrado por SQL directo para el único escenario que necesita una cuenta ya verificada
CI ya levanta `apps/api`+Postgres real para Cypress (ADR-035, `ci.yml::quality-ts`). Los escenarios de registro (email duplicado, contraseña débil), login con credenciales incorrectas, y login rechazado por email sin verificar (+ reenvío) son verificables contra el backend real sin necesitar que llegue ningún email de verdad — una cuenta recién registrada ya está sin verificar por defecto, exactamente el estado que hace falta para esos casos. **Solo el escenario "login correcto"** necesita una cuenta ya verificada, y verificarla de verdad exigiría recibir un email real (inviable en CI, cuota de Resend limitada) — se sembrará con una consulta SQL directa contra el Postgres de test (`docker exec ... psql -c "UPDATE users SET email_verified = true WHERE email = '...'"`, vía `cy.exec`) tras un registro real por API, mismo tipo de manipulación directa de BD ya usado manualmente por el propio desarrollador durante la verificación de `confirmacion-email-usuarios`/`reset-contrasena` esta sesión — no es un atajo nuevo, es formalizar en el test lo que ya se hacía a mano.

## Risks / Trade-offs

- **[Riesgo] Un usuario que cierra la app sin cerrar sesión, y otra persona usa el mismo dispositivo, vería la sesión de la primera persona en Perfil** — aceptado: la app ya asume un único usuario por dispositivo en todos los demás datos (`profile`, `routes`, sin ningún concepto de multi-usuario, ver `sqlite-profile.repository.ts`), la sesión no es distinta en ese sentido. Fuera de alcance introducir aislamiento multi-usuario aquí.
- **[Riesgo] El token guardado no tiene mecanismo de refresco** — expira a las 24h (`tokenTTL`, `apps/api/cmd/api/main.go`) y no hay endpoint de renovación. Pasado ese tiempo, la próxima apertura de Perfil lo detecta vía `/api/auth/me` (401) y pide login de nuevo — aceptado como comportamiento correcto para este alcance, no roto.
- **[Riesgo] Cambios en `profile.element.ts` para añadir la sección "Cuenta"** — impacto acotado: se añade una sección más al método `render()` ya existente, mismo patrón que las tres secciones actuales, sin tocar su lógica de negocio (`profile.service.ts`, `profile.transform.ts` no cambian).
