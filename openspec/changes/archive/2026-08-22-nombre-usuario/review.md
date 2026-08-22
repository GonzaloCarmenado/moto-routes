# Review: nombre-usuario

## CRÍTICO — leer primero

- **Seguridad**: sin secretos nuevos ni criptografía hecha a mano. `PATCH /api/auth/username` es un endpoint autenticado nuevo y lleva rate limiting propio (`RateLimitedUsernameHandler`, `LoginRateLimiter(5, 15min)` keyed por `userID`, ver `apps/api/cmd/api/main.go`). `POST /api/auth/register` ya tenía rate limiting previo (`RateLimitedRegisterHandler`), reutilizado sin cambios. No hay enumeración de cuentas nueva: un username duplicado responde 409 igual que antes con el email, y a diferencia del email un username no es un dato sensible — es el identificador público que el propio usuario elige para que otros lo vean (precondición de la futura `agregar-amigos`), así que confirmar que "ya está en uso" no es una fuga de información distinta de lo que ya hace cualquier formulario de elegir nombre de usuario.
- **Bug real encontrado y corregido durante esta revisión, no en la implementación original**: `httpmw/cors.go` no incluía `PATCH` en `Access-Control-Allow-Methods` — el nuevo endpoint `PATCH /api/auth/username` quedaba bloqueado por el preflight del navegador (confirmado con un `fetch()` real: `TypeError: Failed to fetch`), aunque `curl` y los tests Go no lo detectaban. Mismo patrón de gap ya documentado dos veces antes en el propio fichero (con `POST` de auth y `DELETE` de fotos). Corregido añadiendo `PATCH` a la lista, con test TDD nuevo (`cors_test.go::TestPublicCORS_AllowsMethodsPATCHForPreflight`). Sin este fix, `username.cy.ts` fallaba y ningún cliente real habría podido editar su username nunca.
- **`src/shared/` tocado solo en lo ya previsto por `design.md`**: `CurrentUser`/`fetchCurrentUser` en `apps/mobile/src/auth/auth-api.service.ts` gana el campo `username` (no es technically `src/shared/`, es `src/auth/`, que ya era el dueño de ese tipo). Ningún fichero de `src/shared/` fue modificado por este cambio. Radio de impacto: cero sobre otros dominios.
- **Regla del proyecto saltada, corregida en el momento de encontrarla**: durante la verificación de 7.4 en Android real se tocó brevemente el CSP de `apps/mobile/index.html` y `src-tauri/tauri.conf.json` para permitir una IP de LAN temporal (patrón ya usado en sesiones anteriores) — revertido antes de cerrar, confirmado con `git diff` limpio en ambos ficheros.

## Mapeo Requirement → Scenario → Test

### Requirement: Registro de usuario con email y contraseña (MODIFIED)

| Scenario | Test |
|---|---|
| Registro correcto con datos válidos | `apps/api/internal/auth/register_test.go::TestRegisterHandler_ValidDataCreatesAccountWithoutPasswordInResponse` + `apps/mobile/cypress/e2e/auth/username.cy.ts` (7.1, registro real por UI) |
| Registro rechazado por email ya existente | `register_test.go::TestRegisterHandler_DuplicateEmailIsRejectedWithoutCreatingASecondAccount` (preexistente) |
| Registro rechazado por contraseña débil | `register_test.go::TestRegisterHandler_WeakPasswordIsRejectedWithoutCreatingAnAccount` (preexistente) + `auth.cy.ts` ("registro rechazado por contraseña débil") |
| Registro rechazado por nombre de usuario ya en uso | `register_test.go::TestRegisterHandler_UsernameAlreadyTakenIsRejectedWithoutCreatingASecondAccount` (**añadido durante esta revisión**, ver Hallazgos) + `auth-register-dialog.element.spec.ts::"error username-taken se muestra inline..."` (frontend, backend mockeado) |
| Registro rechazado por formato de nombre de usuario inválido | `register_test.go::TestRegisterHandler_InvalidUsernameFormatIsRejectedWithoutCreatingAnAccount` (**añadido durante esta revisión**) + `user_test.go::TestValidateUsername` (10 casos de formato) |

### Requirement: Una cuenta existente sin nombre de usuario queda bloqueada hasta fijarlo (ADDED)

| Scenario | Test |
|---|---|
| Iniciar sesión en cuenta sin username muestra la pantalla de bloqueo | `username.cy.ts` (7.2, login interactivo) + **verificación manual en Android real** (`75fe536b`, `prueba@prueba.com`) |
| Fijar un username válido y disponible restaura el acceso | `username.cy.ts` (7.2) + **verificación manual en Android real** |
| Intentar fijar uno ya en uso mantiene el bloqueo | `username-form.element.spec.ts::"muestra el error del backend si setUsername falla (p. ej. ya en uso)"` — a nivel de componente compartido, no un E2E específico contra la pantalla de bloqueo (ver Hallazgos, no bloqueante: el componente es idéntico en ambos contextos) |
| Una cuenta recién registrada nunca ve la pantalla de bloqueo | `username.cy.ts` (7.1) |

### Requirement: El nombre de usuario se puede editar después de fijado (ADDED)

| Scenario | Test |
|---|---|
| Editar por otro disponible | `username.cy.ts` (7.3) + `profile.element.spec.ts` (6.2) |
| Editar rechazado por estar ya en uso | `username.cy.ts` (7.3) + `profile.element.spec.ts` (6.3) |
| No se puede dejar vacío | `profile.element.spec.ts` (6.4) + `username-form.element.spec.ts::"no llama al backend si el campo está vacío"` |

**Cobertura de escenarios: 12/12 con al menos un test automatizado.** Dos escenarios de la pantalla de bloqueo (7.2, 7.4) tienen además verificación manual real en dispositivo Android — obligatoria por el propio `tasks.md` del cambio, dado que el bloqueo depende de comportamiento de WebView/CORS que Cypress no reproduce siempre con el mismo rigor (ver Hallazgos).

## Hallazgos

1. **[cobertura, corregido durante esta revisión]** `TestRegisterHandler_UsernameAlreadyTakenIsRejectedWithoutCreatingASecondAccount` y `TestRegisterHandler_InvalidUsernameFormatIsRejectedWithoutCreatingAnAccount` no existían en `register_test.go` pese a que `tasks.md` 2.1 los daba por hechos — el propio `RegisterHandler` ya implementaba el rechazo correctamente (verificado leyendo `register.go`), pero sin un test que lo ejercitara directamente en ese endpoint (solo indirectamente vía `validateUsername`/`ErrUsernameTaken` en otros contextos). Añadidos ambos, en verde sin tocar el código de producción.
2. **[cobertura, no bloqueante]** El escenario "intentar fijar un username ya en uso mantiene el bloqueo" en la pantalla `username-gate` concreta no tiene su propio E2E — solo el comportamiento equivalente en el diálogo de edición desde Perfil (`username.cy.ts` 7.3) y el test de componente compartido. Como `<username-form>` es el mismo componente en ambos contenedores (Decisión 5 de `design.md`), el riesgo real de un bug específico al contexto "gate" es bajo. No se añade un E2E nuevo para esto por proporcionalidad — dejarlo anotado en vez de ignorarlo en silencio.
3. **[gap real de diseño, encontrado y corregido durante la implementación de esta sesión]** `<profile-view>` no refrescaba su sección de cuenta tras fijar el username desde la pantalla de bloqueo (se construye una sola vez en `init()`, no en cada visita a Perfil) — arreglado en `app.element.ts::refreshProfileAccountState()`. Cubierto por `username.cy.ts` (7.2, que verifica que Perfil ya lo muestra sin recargar).
4. **[calidad, sin acción]** `apps/api/cmd/api/main.go` y varios ficheros de `apps/api` muestran diferencias de fin de línea (CRLF) en `gofmt -l` no relacionadas con este cambio — preexistente al entorno Windows de desarrollo, no introducido aquí (confirmado con `gofmt -d`: diffs de línea completa idénticos, no de contenido).

## Verificación independiente

Suite completa re-ejecutada en esta revisión, no solo aceptado el resumen de la implementación: `go test ./...` (191/191, incluye los 2 tests nuevos), `govulncheck`/`gofmt`/`go vet` limpios (salvo el ruido CRLF preexistente del punto 4), `tsc --noEmit` limpio, `eslint --max-warnings 0` limpio, `vitest run --coverage` (1268/1268), `cypress run` contra backend real (81/81, incluye `username.cy.ts` 3/3). Verificación manual completa en Android real (`75fe536b`, build debug apuntando a la LAN): cuenta preexistente `prueba@prueba.com` (username `NULL` real en Postgres) bloqueada al iniciar sesión por UI, `pruebauser1` fijado restaura el acceso sin nuevo login, Perfil lo refleja de inmediato.

## Veredicto: **APPROVED WITH MINOR ISSUES**

Ningún gap de implementación, ninguna desviación de la spec, ningún problema de seguridad. Los dos hallazgos de cobertura (#1 corregido en el momento, #2 documentado y aceptado por proporcionalidad) son el único motivo de no dar `APPROVED` sin matices.
