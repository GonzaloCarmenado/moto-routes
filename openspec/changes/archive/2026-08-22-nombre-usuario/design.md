## Context

`users` (`apps/api/internal/auth/`) no tiene ningún campo de identidad pública hoy: `StoredUser{ID, Email, PasswordHash, EmailVerified}` (`user.go`). El "Nombre" que ya existe en `apps/mobile/src/profile/` (`profile.element.ts`, `IProfileRepository`) es puramente local (SQLite del dispositivo), nunca sincronizado con el backend — no debe confundirse con este `username`, que sí vive en la cuenta del servidor.

No existe hoy ningún gate global de sesión en la app: `app-root::init()` (`apps/mobile/src/app/app.element.ts`) ya lee la sesión guardada una vez al arrancar (para el re-registro del token FCM, líneas 211-213) pero no bloquea ninguna vista por ello — el login es opcional y su único punto de entrada es la tarjeta de cuenta dentro de Perfil (`auth-section.ts`, invocado desde `profile.element.ts`).

Las migraciones del proyecto (`apps/api/internal/migrate/migrations/`) son de un solo paso, sin backfill (`0003_add_email_verification.sql`, `0007_add_route_favorite.sql`) — pero ninguna de esas columnas era `UNIQUE` sobre una tabla con filas ya existentes sin valor posible. `users.username` no tiene ningún valor razonable que rellenar automáticamente para las cuentas ya existentes.

Ver proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Cada cuenta activa termina teniendo un `username` único, sin excepción, aplicado en el cliente (bloqueo) más que en la base de datos (que no puede exigir `NOT NULL` de golpe sobre filas ya existentes).
- Registro, fijado (cuentas existentes) y edición (después de fijado) comparten exactamente la misma validación de formato/unicidad en el backend — una sola fuente de verdad.
- El bloqueo de cuentas existentes es la única pieza de UI realmente nueva de peso — reutiliza el sistema de vistas ya existente en `app-root` en vez de introducir un patrón de enrutado nuevo.

**Non-Goals:**
- La spec de "agregar amigos" en sí (invitar, aceptar, listar) — este cambio solo deja el campo `username` listo para que la consuma.
- Un endpoint público de "comprobar disponibilidad de username mientras se escribe" — el registro con email tampoco lo tiene hoy (se envía y se recibe un 409 si está en uso); mismo criterio aquí, sin ampliar la superficie pública del API sin necesidad real.
- Renombrar o tocar el "Nombre" local ya existente en Perfil — sigue siendo un campo distinto, sin relación con `username`.
- Migrar/rellenar automáticamente el `username` de cuentas existentes — no hay ningún valor derivable con sentido (el email es sensible, no se debe usar como base pública).

## Decisions

**Decisión 1 — Migración en un solo paso: `username TEXT NULL` + índice único sobre `lower(username)`, nunca `NOT NULL` a nivel de base de datos.** Postgres no considera dos `NULL` iguales bajo un índice único, así que múltiples cuentas sin username conviven sin conflicto — la garantía de "toda cuenta activa tiene username" la da el bloqueo de frontend (Decisión 3), no una constraint de BD que exigiría un backfill imposible de justificar (ver Non-Goals). Unicidad case-insensitive vía índice sobre `lower(username)` (mismo criterio ya aplicado a comparaciones de email en el proyecto), preservando la capitalización tal cual la escribió el usuario para mostrarla.

**Decisión 2 — Un único endpoint `PATCH /api/auth/username` para fijar y para editar, sin distinguir "primera vez" de "cambio".** Backend-mente es la misma operación (username actual → username nuevo, con las mismas reglas de validación/unicidad) tanto si el campo estaba `NULL` como si ya tenía un valor — separar dos endpoints solo duplicaría la validación sin ganar nada. La diferencia entre "pantalla de bloqueo" y "editar desde perfil" es puramente de frontend (cuándo se muestra y si es descartable), no de backend. `RateLimitedRegisterHandler` es el precedente directo para envolverlo con `LoginRateLimiter` (instancia propia, keyed por `userID` — es un endpoint autenticado, no hace falta keyear por email como en registro).

**Decisión 3 — Bloqueo de frontend como una vista más del sistema ya existente en `app-root`, no un router nuevo.** `app-root` ya alterna 6 vistas por `display: none/''` (`showView()`); se añade una séptima (`username-gate`, no accesible desde `nav-bar`) que, si se detecta sesión activa **y** `GET /api/auth/me` devuelve `username: null`, se muestra en vez de la vista inicial (`cockpit`), ocultando el resto — hasta que el fijado tiene éxito, momento en el que se llama a `showView('cockpit')` con normalidad. La comprobación (`checkUsernameGate()`) se dispara en dos momentos, no solo uno: al arrancar en frío (`init()`, sesión ya persistida) y tras un login interactivo dentro de una sesión de app ya abierta — `profile-account.ts::handleOpenLogin` despacha el evento `auth-logged-in` (mismo bus de `shared/app-events.ts` que `view-sharing`/`view-route`) al que `app-root` se suscribe para re-ejecutar la misma comprobación. Sin este segundo disparo, una cuenta preexistente sin username podría loguearse dentro de una app ya abierta y usarla sin bloqueo hasta el siguiente reinicio — contradice "obligatorio desde ya" y el propio Riesgo documentado más abajo (gap real, encontrado al escribir el E2E de este grupo, no parte del diseño original). Alternativa descartada: un router/guard nuevo — sobre-ingeniería para una app de 6 vistas ya gestionadas así; añadir una séptima es coherente con el patrón existente.

**Decisión 4 — Un fallo de red al comprobar el username no bloquea la app.** Mismo criterio best-effort que el resto de comprobaciones en segundo plano de `init()` (p. ej. `refreshStopTypesCache`): si `GET /api/auth/me` falla (sin conexión), la app arranca o continúa con normalidad sin mostrar el bloqueo — se volverá a comprobar en el siguiente arranque o login interactivo (ver Decisión 3). Consecuencia aceptada: una cuenta sin username y sin conexión en el primer arranque tras esta migración podría usar la app una vez sin que se le pida — se prioriza no dejar la app inutilizable por un fallo de red transitorio.

**Decisión 5 — Un único componente presentacional para el formulario de username, reutilizado por el bloqueo (no descartable) y por la edición desde Perfil (descartable).** Mismo campo, misma validación en cliente (formato) antes de llamar al backend, mismos mensajes de error — solo cambia el contenedor (pantalla completa sin botón de cancelar vs. diálogo modal con botón de cancelar, siguiendo el patrón overlay/`trapFocus` ya usado por `profile-edit-dialog.element.ts`).

**Decisión 6 — Formato del username: minúsculas, dígitos y guion bajo, 3-20 caracteres, validado igual en Go y en TypeScript.** Elección concreta razonable sin precedente exacto en el proyecto (el email usa una regex mínima permisiva) — se documenta aquí explícitamente para que el usuario pueda corregirla antes de `/opsx:apply` si prefiere otras reglas (mayúsculas permitidas, longitud distinta, etc.).

## Risks / Trade-offs

- **[Riesgo] Una cuenta con sesión guardada pero sin username, sin conexión, queda "atascada" viendo el bloqueo indefinidamente si nunca recupera red.** → Mitigación: mismo riesgo ya aceptado implícitamente por cualquier pantalla que dependa de red en esta app; no es peor que perder acceso a cualquier otra función de nube sin conexión.
- **[Riesgo] Cuentas de prueba ya sembradas en Docker local/Cypress (`prueba@prueba.com`, etc.) quedarán sin username tras aplicar la migración — primer login tras este cambio las bloqueará.** → Mitigación: es el comportamiento correcto y esperado (ver Decisión 1); se documenta en `tasks.md` como parte de la verificación manual, no como bug.
- **[shared] No se toca `src/shared/` salvo el tipo `CurrentUser`/`fetchCurrentUser` en `shared/http/auth-api.service.ts` (ya existente, se le añade el campo `username`) — sin radio de impacto nuevo sobre otros dominios.**
