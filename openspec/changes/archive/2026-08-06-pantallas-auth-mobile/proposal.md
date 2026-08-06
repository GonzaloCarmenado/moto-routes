## Why

`apps/api` ya tiene registro, login, verificación de email y reset de contraseña completos y verificados en producción (ADR-034, ADR-038, ADR-039), pero `apps/mobile` no tiene ninguna pantalla que los use — hoy es imposible crear una cuenta o iniciar sesión desde la app. Es la pieza de frontend que quedó explícitamente pendiente en las tres sesiones de backend anteriores.

## What Changes

- Nueva sección "Cuenta" dentro de la pantalla Perfil (decisión tomada con el usuario: encaja con lo que ya existe ahí, sin añadir una pestaña nueva a la nav-bar).
  - **Sin sesión activa**: botones "Iniciar sesión" y "Crear cuenta".
  - **Con sesión activa**: email de la cuenta y botón "Cerrar sesión".
- Tres diálogos nuevos (mismo patrón que `profile-edit-dialog`/`profile-vehicle-dialog`, no páginas de ruta nuevas):
  - **Crear cuenta**: email + contraseña → `POST /api/auth/register`. Éxito: mensaje "revisa tu email para verificar la cuenta", sin iniciar sesión automáticamente (la cuenta no está verificada todavía, el login fallaría). Errores: email duplicado, contraseña débil, email inválido, límite de intentos.
  - **Iniciar sesión**: email + contraseña → `POST /api/auth/login`. Éxito: guarda el token localmente, cierra el diálogo. Error de credenciales: mensaje genérico (no distingue email inexistente de contraseña incorrecta, mismo criterio anti-enumeración que ya aplica el backend). Error específico de email sin verificar: mensaje distinto con un botón "Reenviar email de verificación" (`POST /api/auth/verify-email/request`).
  - **Recuperar contraseña**: solo email → `POST /api/auth/reset-password/request`. Siempre el mismo mensaje de éxito genérico (igual que responde el backend, sin excepciones en el lado móvil) — el resto del flujo (abrir el enlace, escribir la contraseña nueva) ocurre en la página web ya construida por `apps/api` (`reset-contrasena`, ADR-039), fuera de la app.
- **Sesión persistida localmente en SQLite** (decisión tomada con el usuario: mismo patrón que `profile`/`routes`, tabla de una sola fila) — para que un futuro cambio de "gating" (exigir sesión para usar el resto de la app) pueda reutilizarla sin rehacer esto.
- Al abrir la pantalla Perfil con una sesión guardada, se revalida contra `GET /api/auth/me` — si el token ya no es válido (expirado, revocado), se limpia la sesión local y vuelve al estado "sin sesión" en vez de mostrar un email obsoleto.

Fuera de alcance (confirmado con el usuario): **nada del resto de la app pasa a exigir sesión todavía** — cockpit, rutas y el resto de Perfil siguen funcionando exactamente igual, con o sin cuenta. Esa es una spec de "gating" aparte, más adelante.

## Capabilities

### New Capabilities
- `mobile-auth-screens`: pantallas de registro, login, recuperación de contraseña y cierre de sesión en `apps/mobile`, con persistencia local de la sesión.

## Impact

- **Código nuevo**: `apps/mobile/src/auth/` (dominio nuevo — `auth-section.element.ts`, `auth-login-dialog.element.ts`, `auth-register-dialog.element.ts`, `auth-forgot-password-dialog.element.ts`, servicios asociados), `apps/mobile/src/shared/models/session.repository.ts` + `session.types.ts`, `apps/mobile/src/shared/repositories/{sqlite,memory}-session.repository.ts` (+ factory), `apps/mobile/src/shared/http/external-api.service.ts` ampliado para soportar `POST` con body (hoy solo `GET`).
- **Código afectado**: `apps/mobile/src/profile/profile.element.ts` (nueva sección "Cuenta"), `apps/mobile/src/app/app.element.ts` (wiring del repositorio de sesión, mismo patrón que `profileRepo`).
- **Sin cambios en `apps/api`** — consume los endpoints ya existentes y verificados, ninguno nuevo.
- **Sin variables de entorno nuevas** — reutiliza `VITE_API_BASE_URL`/`getApiBaseUrl()` ya existente (ADR-035).
