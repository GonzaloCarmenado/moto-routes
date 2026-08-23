## 1. Backend: paquete de avatar (subir/descargar, sin migración — ver ADR-055)

- [x] 1.1 Test rojo (integración real contra MinIO, mismo patrón que `internal/photos/blob_store_test.go`): subir un avatar con éxito lo deja disponible para descargar, con los mismos bytes tras descifrar.
- [x] 1.2 Test rojo: subir un avatar nuevo sobre una cuenta que ya tenía uno sustituye al anterior (misma clave determinista `avatars/{userID}`), sin acumular objetos.
- [x] 1.3 Test rojo: subir un avatar que supera 5MB se rechaza (400), sin sustituir el avatar ya existente.
- [x] 1.4 Test rojo: subir sin sesión activa se rechaza (401), sin almacenar nada.
- [x] 1.5 Implementar `UploadAvatarHandler` hasta verde — reutiliza `BlobStore`/`Encrypt` de `internal/photos` (mismo bucket, mismo `cfg.PhotoEncryptionKey`), clave de objeto `avatars/{userID}`.
- [x] 1.6 Test rojo: descargar el avatar de una cuenta sin avatar configurado devuelve 404, sin fallar de forma ambigua.
- [x] 1.7 Test rojo: descargar sin sesión activa se rechaza (401).
- [x] 1.8 Implementar `DownloadAvatarHandler` hasta verde — `NoSuchKey` de MinIO se traduce a 404 (ver `Decrypt`/`ObjectExists` ya usado en `internal/photos`).
- [x] 1.9 Registrar `POST /api/auth/avatar` y `GET /api/auth/avatar` en `cmd/api/main.go`, autenticados (`auth.RequireAuth`), con `httpmw.PublicCORS` — verificar explícitamente (con un `fetch()` real desde un navegador, no solo `curl`) que `POST`/`GET` están cubiertos por `Access-Control-Allow-Methods` antes de dar por hecho que el preflight funciona. Gap real ya visto cuatro veces en este mismo fichero (ver `httpmw/cors.go`, la última con `PATCH` en `nombre-usuario`) — `POST`/`GET` ya están en la lista actual, pero comprobarlo igual, no asumir. `Access-Control-Allow-Methods` confirmado como "GET, POST, PATCH, DELETE, OPTIONS" (`httpmw/cors.go:39`) — cubre ambos métodos nuevos sin cambios. Verificación con `fetch()` real de navegador queda cubierta por Cypress en 6.1–6.3 (llamadas reales cross-origin, no solo `curl`).

## 2. Frontend: tipos y servicio HTTP para el avatar de cuenta

- [x] 2.1 Test rojo en `auth-api.service.spec.ts` (o un `avatar-api.service.ts` nuevo si crece demasiado): `uploadAccountAvatar(apiBaseUrl, token, file)` y `fetchAccountAvatar(apiBaseUrl, token)` — éxito, 404 (sin avatar, no es un error), sin sesión.
- [x] 2.2 Implementar hasta verde, mismo patrón de error tipado ya usado (`AuthApiError`/`ExternalApiError`).

## 3. Frontend: Perfil muestra el username como nombre, sin campo de nombre local

- [x] 3.1 Test rojo: `profile.element.ts` muestra el `username` de la cuenta autenticada como nombre, sin ningún campo de nombre editable en el modal "Editar perfil".
- [x] 3.2 Test rojo: sin sesión activa, Perfil no muestra ningún nombre de cuenta.
- [x] 3.3 Implementar hasta verde: `profile.service.ts::loadProfile` deja de leer `Profile.name`; `profile-edit-dialog.element.ts` pierde el campo de nombre; `sanitizeProfileName` (`profile.transform.ts`) se elimina (junto con `resolveDisplayName`/`DEFAULT_PROFILE_NAME`, sin uso ya).
- [x] 3.4 Actualizar `Profile`/`CreateProfile` (`shared/models/profile.types.ts`): quitar `name`/`avatarPath`. El repositorio local (`sqlite-profile.repository.ts`, `memory-profile.repository.ts`) deja de seleccionar/escribir esas columnas — **sin `DROP COLUMN`** (ver ADR-055, mismo patrón aditivo-only que `sqlite-route.repository.ts`).

## 4. Frontend: descarga automática del avatar al iniciar sesión

- [x] 4.1 Test rojo: arranque en frío con sesión ya guardada y avatar configurado en el servidor descarga y cachea el avatar (mismo punto de enganche que `checkUsernameGate()` en `app.element.ts`).
- [x] 4.2 Test rojo: login interactivo en un dispositivo que nunca subió el avatar lo descarga igualmente.
- [x] 4.3 Test rojo: cuenta sin avatar configurado (404) no muestra ningún error, mismo estado vacío que hoy.
- [x] 4.4 Test rojo: un fallo de red al descargar el avatar no bloquea el resto de Perfil (best-effort, mismo criterio que Decisión 4 de `nombre-usuario`).
- [x] 4.5 Implementar hasta verde — cachea el avatar descargado como fichero local (mismo mecanismo que `photo-storage.service.ts`), sin tabla SQLite propia (ver design.md, Decisión 3). Nuevo `account-avatar-cache.ts`, resolución integrada en `ProfileAccountController.refresh()` (no en `AuthSectionState`/`loadAuthSectionState`, que no cambian — ver proposal.md, Modified Capabilities: ninguna).

## 5. Frontend: subir un avatar nuevo desde Perfil

- [x] 5.1 Test rojo: elegir una nueva imagen de avatar desde Perfil la sube a la cuenta (no a SQLite local) y la refleja de inmediato.
- [x] 5.2 Test rojo: la subida falla (sin conexión, o supera 5MB) y Perfil sigue mostrando el avatar anterior, con un error visible.
- [x] 5.3 Implementar hasta verde. `profile-edit-dialog.element.ts` pasa de "Editar perfil" (nombre+avatar local) a solo avatar de cuenta — campo de nombre eliminado, "Guardar" deshabilitado hasta elegir una foto nueva.

## 6. E2E y verificación real

- [x] 6.1 Cypress: tras login, Perfil muestra el `username` como nombre (backend real). `avatar-identidad.cy.ts`.
- [x] 6.2 Cypress: subir un avatar desde Perfil y verlo reflejado sin recargar. `avatar-identidad.cy.ts`.
- [x] 6.3 Cypress: una cuenta con avatar ya subido (sembrado vía API en el propio test) lo descarga y muestra al iniciar sesión en una "sesión nueva" (mismo patrón de aislamiento que `route-cloud-sync.cy.ts`). `avatar-identidad.cy.ts` — sembrado subiendo una vez por la UI real (misma llamada `POST /api/auth/avatar` que un `cy.request` multipart habría hecho) en vez de construir la petición multipart a mano dentro del test, mismo criterio ya documentado en `route-sharing.cy.ts`.
- [x] 6.4 Verificación manual en dispositivo Android real (`75fe536b`, USB, `adb reverse tcp:8080 tcp:8080` contra `docker-api-1` reconstruido con el paquete `avatar`): login real, subida de avatar, cierre/reinicio de la app (arranque en frío con sesión ya guardada) y confirmación de que el avatar se descarga y muestra solo. **Bug real encontrado y arreglado en esta verificación** (invisible en Vitest/Cypress, ninguno de los dos ejercita el plugin-fs real de Tauri): `account-avatar-cache.ts` escribía en `$APPDATA/account-avatar.bin` — fuera del scope concedido por `capabilities/default.json` (`fs:allow-write-file` solo cubre `$APPDATA/photos/**`), rechazado en silencio por el catch-all de `resolveAccountAvatarUrl` (ningún error visible, solo el placeholder no desaparecía nunca). Corregido moviendo el fichero cacheado a `$APPDATA/photos/account-avatar.bin` (reutiliza el scope ya concedido, sin tocar `capabilities/default.json`), con `exists`/`mkdir` igual que `photo-storage.service.ts`. **Ajuste de UX pedido por el usuario tras ver el resultado, sobre la marcha**: "Editar perfil" pasa a ser el único punto de edición de identidad visible en la pantalla principal — el username ya no tiene su propio botón "Editar"/"Fijar" en la sección "Cuenta" (redundante con la cabecera, que ya muestra el username como nombre); se edita desde un botón "Editar nombre de usuario"/"Fijar nombre de usuario" dentro del propio diálogo de avatar, que abre `username-edit-dialog` sin cambios (nested, mismo guardado inmediato de siempre). `auth-section.ts` pierde `buildUsernameRow`/`onEditUsername`; `ProfileAccountController.handleEditUsername` pasa a público y devuelve el username actualizado para refrescar la previsualización sin cerrar "Editar perfil". Verificado de nuevo en el propio dispositivo tras el cambio.

## 7. Cierre

- [x] 7.1 Suite completa en verde: Go (`go test ./...` 201/201, `govulncheck` 0 vulnerabilidades explotadas, `go vet` limpio), `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, `vitest run --coverage` 1270/1270 (statements 97.09%, methods 95.56%, muy por encima del 80%), Cypress 82/82 contra backend real (`docker-api-1` reconstruido con el nuevo paquete `avatar`). `gofmt -l` marca casi todo el repo Go por `core.autocrlf=true` en este checkout Windows (confirmado con `gofmt -d`: solo diffs de fin de línea, ni un solo cambio de contenido) — artefacto de entorno preexistente, no una regresión de este cambio, no se toca.
- [x] 7.2 Sincronizar la spec `identidad-cuenta` (delta de este cambio) a `openspec/specs/` — capability nueva, `openspec validate --all --strict` en verde (27/27).
- [x] 7.3 Actualizar `memory/context.md` (Estado Actual del Proyecto) con el resumen de la sesión. `memory/decisions.md` ya tiene la ADR-055 escrita durante `propose` — confirmado que la decisión no se desvió durante la implementación (sin migración, `avatars/{userID}`, 5MB, sin rate limiting dedicado, `/me` sin cambios, columnas SQLite preservadas).
