# Review: unificar-perfil-cuenta

## CRÍTICO (leer primero)

- **Seguridad**: sin secretos nuevos, sin criptografía hecha a mano (`internal/avatar` reutiliza `photos.Encrypt`/`Decrypt`, AES-256-GCM ya auditado en `nombre-usuario`/`route-photo-storage`), sin credenciales ni tokens en el diff. El nuevo endpoint `POST/GET /api/auth/avatar` reutiliza `auth.RequireAuth` (mismo JWT ya validado en todo el resto de la API) — no es un endpoint de autenticación (no crea/valida credenciales), así que no lleva rate limiting dedicado, mismo criterio ya aplicado a `POST /api/routes/{id}/photos` (ver ADR-055, Consecuencias). Sin cambios de CSP: `/api/auth/avatar` vive bajo el mismo origen `http://localhost:8080`/host de producción que el resto de `apps/api`, ya presente en `connect-src`.
- **Componentes compartidos tocados**: `auth-section.ts` pierde `buildUsernameRow`/`onEditUsername` — radio de impacto verificado: su único consumidor es `profile-account.ts` (`grep` confirmado, sin otros call sites). `photo-storage.service.ts`/`photo-capture-adapter.service.ts` no se modifican, solo se reutilizan (`account-avatar-cache.ts`, `profile-edit-dialog.element.ts`).
- **Regla del proyecto saltada, con justificación**: ninguna. `sqlite-profile.repository.ts` sigue el patrón aditivo-only exigido (columnas `avatar_path`/`name` preservadas sin `DROP COLUMN`, verificado con test dedicado).
- **Desviación real sobre el plan original de `tasks.md`, decidida junto al usuario durante 6.4**: el username pasa de tener su propio botón "Editar"/"Fijar" en la sección "Cuenta" a editarse desde dentro del mismo diálogo "Editar perfil" (un único punto de edición de identidad visible en la pantalla principal). No estaba en el `design.md` original — se decidió sobre la marcha tras la primera verificación en dispositivo real, a petición explícita del usuario ("no quiero 2 botones distintos, ambos juntos dentro del botón de editar"). No contradice ninguna Decisión de `design.md` (que no especificaba la disposición de botones) ni ningún Requirement de la spec (que solo exige que el username se pueda editar desde Perfil, sin fijar desde dónde). Sin ADR nueva: es un ajuste de disposición de UI, no una decisión de arquitectura con alternativas descartadas.

## Mapeo Requirement → Scenario → Test

### El nombre mostrado en Perfil es el username de la cuenta
- Perfil muestra el username como nombre → `profile.element.spec.ts` ("con sesión activa y avatar configurado en la cuenta..."), `avatar-identidad.cy.ts` (6.1, backend real)
- Sin sesión activa, Perfil no muestra ningún nombre de cuenta → `profile.element.spec.ts` ("con un perfil vacío y sin sesión..."), `perfil.cy.ts` ("shows the avatar placeholder, no name...")

### Subir el avatar de la cuenta autenticada
- Subida correcta → `internal/avatar/handler_test.go::TestUploadAvatarHandler_SuccessMakesItAvailableToDownloadWithSameBytes`
- Sustituye al anterior → `TestUploadAvatarHandler_UploadingANewAvatarReplacesThePrevious`
- Supera el tamaño máximo se rechaza → `TestUploadAvatarHandler_OversizedAvatarIsRejectedWithoutReplacingExisting`
- Sin sesión no se puede subir → `TestUploadAvatarHandler_WithoutSessionIsRejected`

### Descargar el avatar de la cuenta autenticada
- Descarga correcta → `TestUploadAvatarHandler_SuccessMakesItAvailableToDownloadWithSameBytes` (round-trip)
- Cuenta sin avatar configurado → `TestDownloadAvatarHandler_NoAvatarConfiguredReturnsNotFound`
- Sin sesión no se puede descargar → `TestDownloadAvatarHandler_WithoutSessionIsRejected`

### El avatar se almacena cifrado en reposo
- Los bytes almacenados no son la imagen original → `TestUploadAvatarHandler_StoredBytesAreNotThePlaintextImage` — **gap real encontrado durante esta revisión** (el resto de escenarios ya estaba cubierto, este no tenía test dedicado pese a estar en la spec; añadido antes de archivar, ver commit).

### El avatar se descarga automáticamente al iniciar sesión
- Arranque en frío con sesión guardada y avatar ya configurado → `account-avatar-cache.spec.ts` (4.1/4.2), verificación manual en Android real (6.4)
- Login interactivo en un dispositivo que nunca subió el avatar → `account-avatar-cache.spec.ts` (4.1/4.2), `avatar-identidad.cy.ts` (6.1-6.3, login real de principio a fin)
- Cuenta sin avatar configurado en ningún dispositivo → `account-avatar-cache.spec.ts` (4.3), `perfil.cy.ts`
- Fallo de red no bloquea el resto de la app → `account-avatar-cache.spec.ts` (4.4)

### Subir un nuevo avatar desde Perfil
- Cambiar el avatar con éxito → `profile-edit-dialog.element.spec.ts`, `profile.element.spec.ts` ("after saving a new avatar..."), `avatar-identidad.cy.ts` (6.2, backend real)
- La subida falla sin perder el avatar anterior → `profile-edit-dialog.element.spec.ts` ("keeps the dialog open, shows an error toast and preserves the chosen preview... AC-012, 5.2")

**Verificación manual en dispositivo real (6.4, no automatizable — Tauri plugin-fs real, fuera del alcance de Vitest/Cypress)**: subida, cierre/reinicio de la app y recuperación automática del avatar confirmados en Android real (`75fe536b`, USB). Encontró y corrigió un bug real invisible en los tests automatizados (ver Hallazgos).

## Hallazgos

1. **[gap, corregido]** `El avatar se almacena cifrado en reposo` no tenía test dedicado para avatar (reutilizaba `photos.Encrypt`, ya testeado genéricamente, pero no había una prueba propia del paquete `avatar` que confirmara que los bytes en MinIO no son el PNG original). Añadido `TestUploadAvatarHandler_StoredBytesAreNotThePlaintextImage` antes de archivar.
2. **[desviación, corregida durante la implementación]** `account-avatar-cache.ts` escribía inicialmente en `$APPDATA/account-avatar.bin`, fuera del scope de `capabilities/default.json` (`fs:allow-write-file` solo cubre `$APPDATA/photos/**`) — fallaba en silencio (por diseño del catch-all de ADR-055 "nunca lanza"), sin ningún error visible ni test que lo detectara (Vitest mockea el plugin-fs, no ejercita el scope real de capacidades). Encontrado en la verificación 6.4 en dispositivo real, corregido moviendo el fichero cacheado a `$APPDATA/photos/account-avatar.bin` (reutiliza el scope ya concedido, sin tocar `capabilities/default.json`). Test unitario actualizado para reflejar la ruta correcta.
3. **[hallazgo colateral, no de este cambio, no corregido]** `GET /api/ping` sigue sin `httpmw.PublicCORS` (a diferencia de todos los demás endpoints) — descubierto al usarlo como sonda de conectividad durante la verificación 6.4 (falló con `MissingAllowOriginHeader` desde el WebView real; el resto de endpoints, incluido `/api/auth/avatar`, sí funcionan). Preexistente, fuera de alcance de este cambio — no se toca aquí.
4. **[calidad, aceptado]** `gofmt -l` marca la mayoría de los ficheros Go del repo como "sin formatear" en este checkout — confirmado con `gofmt -d` que es únicamente diferencia de fin de línea (`core.autocrlf=true` en Windows), sin ningún cambio de contenido real, y afecta a ficheros no tocados por este cambio (p. ej. `internal/mapmatch`, `internal/notifications`). Artefacto de entorno preexistente, no una regresión — no se toca.

## Veredicto

**APPROVED**

Todos los escenarios de la spec `identidad-cuenta` están cubiertos por test (backend Go real contra MinIO, frontend Vitest, Cypress E2E contra backend real, y verificación manual en Android real para el único escenario no automatizable). El gap real encontrado en esta revisión (encriptación en reposo sin test dedicado) se corrigió antes de archivar. El bug real de capacidades de Tauri encontrado en 6.4 se corrigió y reverificó en el propio dispositivo. Sin problemas de seguridad, sin normas del proyecto saltadas sin justificación, sin componentes compartidos con radio de impacto no verificado.

**Suite completa (re-ejecutada de forma independiente antes de este veredicto)**: Go 202/202 (`govulncheck`/`go vet` limpios), `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest 1274/1274 (statements 97%+), Cypress 82/82 contra backend real.
