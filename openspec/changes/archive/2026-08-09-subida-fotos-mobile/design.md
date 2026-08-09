## Context

El backend de fotos (`apps/api/internal/photos/`, ya en `master`) expone cuatro endpoints bajo `/api/routes/{id}/photos`, todos tras `RequireAuth`:
- `POST` — sube una foto vía `multipart/form-data` (campo `photo` + campos opcionales `latitude`/`longitude`/`captured_at`), devuelve el `Photo` creado (JSON) con status `201`.
- `GET` — lista metadatos (JSON), `GET .../{photoId}` — descarga bytes descifrados (fuera de alcance de este cambio, ver proposal.md Non-Goals).
- `DELETE .../{photoId}` — borra bytes + metadatos, devuelve `204` sin cuerpo.

El cliente HTTP existente (`external-api.service.ts::fetchJson`) siempre serializa el body a JSON y siempre llama a `response.json()` sobre la respuesta — no sirve tal cual para un `POST` multipart ni para un `DELETE` que devuelve `204` sin cuerpo.

El flujo de UI ya establecido (`route-detail.element.ts`) es: `handleAddPhoto` persiste la(s) foto(s) localmente (`persistSinglePhoto` → `addPhotoToRoute` → `photoRepo.add`) y dispara `triggerAutoResync` en segundo plano (`void autoResyncIfNeeded(...)`, sin bloquear la UI). `handleDeletePhoto` borra la foto localmente (`deletePhotoWithConfirmation`, que ya borra fila + archivo) y dispara el mismo `triggerAutoResync`. Ambos son los dos puntos con `// TODO` a sustituir.

## Goals / Non-Goals

**Goals:**
- Subir el archivo de una foto nueva al backend cuando se añade a una ruta ya sincronizada, en segundo plano, sin bloquear el guardado local ya confirmado.
- Borrar la copia remota de una foto cuando se borra localmente de una ruta ya sincronizada, en segundo plano, con el mismo criterio.
- Persistir localmente si una foto ya tiene copia remota (y su id remoto), para poder borrarla del servidor más tarde sin volver a listar primero.

**Non-Goals** (ver proposal.md):
- Backfill de fotos ya existentes en una ruta sincronizada antes de este cambio.
- Descargar/mostrar fotos de una ruta exclusiva de la nube.
- Cola de reintentos cuando vuelve la conexión — un fallo se queda como "no sincronizada" hasta la siguiente acción del usuario sobre esa foto (mismo criterio que ya rige para rutas: no hay reintento automático de `autoResyncIfNeeded`).
- Indicador visual de "foto sincronizada/no sincronizada" en la UI de la galería — el estado se persiste (Non-Goal de proposal.md no lo prohíbe, pero no es parte de este cambio; queda como dato disponible para una UI futura).

## Decisions

### Decisión 1 — Extender `external-api.service.ts` en vez de duplicar la lógica de timeout/abort
`fetchJson` ya centraliza `AbortController`, timeout y clasificación de errores (`ExternalApiError`). Se extiende en vez de crear un cliente HTTP paralelo:
- `FetchJsonOptions.method` gana `'DELETE'`.
- `FetchJsonOptions.body` acepta también `FormData` — cuando lo es, no se serializa con `JSON.stringify` ni se añade `Content-Type` (el navegador/WebView pone el `boundary` multipart correcto solo; fijarlo a mano lo rompe).
- La respuesta ya no asume siempre JSON: si el `status` es `204` o no hay `Content-Length`, se devuelve `undefined` en vez de intentar `response.json()` (que lanzaría sobre un cuerpo vacío).
Alternativa descartada: un servicio HTTP nuevo solo para fotos, duplicando timeout/abort/clasificación de error — más código y dos sitios que mantener en sincronía para el mismo comportamiento base.

### Decisión 2 — Nuevo `photo-cloud-api.service.ts`, mismo patrón que `route-cloud-api.service.ts`
Un módulo nuevo en `apps/mobile/src/shared/http/` con `uploadRoutePhoto(apiBaseUrl, token, routeId, file, metadata)` y `deleteRoutePhoto(apiBaseUrl, token, routeId, remotePhotoId)`, construyendo el `FormData` y clasificando errores con un `PhotoCloudApiError` propio (mismo `kind` que `RouteCloudApiError`: `unauthorized | too-large | too-many-photos | not-found | network | unknown`, mapeado desde el status HTTP — `400` se distingue por el mensaje del cuerpo de error ya que el backend usa el mismo status para "demasiado grande" y "límite de fotos alcanzado").

### Decisión 3 — Leer los bytes de la foto desde `filePath` en el momento de subir, no guardarlos aparte
La foto local ya persiste su contenido en disco (Tauri: `appDataDir/photos/`, vía `photo-storage.service.ts`) o como `data:` URL (navegador). Para construir el `FormData` se leen los bytes en el momento de la subida (`@tauri-apps/plugin-fs::readFile` en Tauri, `fetch(dataUrl).then(r => r.blob())` en navegador) — mismo patrón ya usado por `getPhotoUrl` para leer el archivo bajo demanda, sin mantener una copia de los bytes en memoria ni en el modelo `Photo`.

### Decisión 4 — Campo `remotePhotoId` en el modelo `Photo`, con migración condicional
Se añade `remotePhotoId: string | null` a la entidad `Photo` (no a `CreatePhoto` — se desconoce hasta que la subida tiene éxito) y un método nuevo `IPhotoRepository.markPhotoSynced(photoId: string, remotePhotoId: string): Promise<void>`. En SQLite, columna `remote_photo_id TEXT` en la tabla `photos`, añadida vía `PRAGMA table_info` + `ALTER TABLE` condicional — mismo patrón ya usado para `preview_polyline` en `routes` (`mejoras-fotos-mapa`, ver memory/decisions.md), porque `CREATE TABLE IF NOT EXISTS` no migra una tabla ya existente con datos de un dispositivo real.

### Decisión 5 — Capturar el `remotePhotoId` antes de borrar la fila local, no después
`handleDeletePhoto` ya borra la fila local (`deletePhotoWithConfirmation`) antes del punto donde vive el segundo `// TODO`. El `remotePhotoId` necesario para el `DELETE` remoto se lee del objeto `Photo` ya cargado en memoria (`this._photos.find(...)`, línea 493) **antes** de invocar el borrado local — una vez borrada la fila, ese dato ya no es recuperable. Si `remotePhotoId` es `null` (la foto nunca llegó a subirse), no se hace ninguna llamada de red (Requirement "Borrar una foto que nunca llegó a subirse..." de la spec).

### Decisión 6 — Subida secuencial, no en paralelo
Cuando se añaden varias fotos desde galería, `handleAddPhoto` ya las persiste localmente en un bucle secuencial (`for (const file of files)`). La subida a la nube seguida se dispara también de una en una (no con `Promise.all`), para no disparar N subidas concurrentes de hasta 15MB cada una sobre una conexión móvil — coherente con que ya es una operación en segundo plano sin indicador de progreso por foto.

## Risks / Trade-offs

- **[Riesgo] Una foto subida con éxito pero cuya escritura de `remotePhotoId` en SQLite falla queda huérfana en el servidor, indistinguible localmente de "nunca subida"]** → Mitigación: mismo perfil de riesgo ya aceptado por el propio backend para el caso simétrico (blob huérfano si falla el registro de metadatos tras subir, ver `handler.go` `UploadHandler`) — inofensivo (nunca referenciado, no consume cuota visible al usuario), no bloqueante para este cambio.
- **[Riesgo] Extender `fetchJson` para aceptar `FormData` y `204` cambia una función usada por integraciones ya existentes (auth, catálogo de tipos de parada, rutas en la nube)** → Mitigación: los cambios son aditivos y solo se activan con `body instanceof FormData` o `status === 204`/sin `Content-Length` — ninguna llamada existente pasa `FormData` ni recibe `204`, así que su comportamiento no cambia. Cubierto con tests de regresión explícitos sobre `fetchJson` para los casos ya existentes.
- **[Riesgo] `src/shared/http/external-api.service.ts` es código compartido — cualquier fallo de esta extensión afecta a auth, rutas en la nube y catálogo de tipos de parada, no solo a fotos]** → Mitigación: cobertura de tests unitarios de `fetchJson` ampliada para los dos casos nuevos antes de tocar ningún consumidor.

## Migration Plan

Sin migración de servidor para el propio dominio de fotos (backend ya desplegado y sin cambios de esquema/API). En el dispositivo: la migración SQLite de `remote_photo_id` sigue el mismo mecanismo ya verificado en producción para `preview_polyline` (condicional, no destructiva, aplica sola al abrir la app con una base de datos ya existente). Sin flag de despliegue ni rollback especial: si el cambio se revierte, la columna queda sin usar (no se borra), sin efecto sobre versiones anteriores de la app.

## Gap real encontrado verificando en un dispositivo Android real (no estaba en el plan)

El borrado de una foto sincronizada funcionaba en Vitest y en Cypress (54/54 en verde, backend real), pero **nunca llegaba al servidor desde el WebView real de Android** — la foto se borraba localmente pero quedaba huérfana en el servidor indefinidamente. Aislado con un `fetch()` crudo vía Chrome DevTools Protocol contra el propio WebView (sin pasar por el código de la app): `GET`/`POST` funcionaban, `DELETE`/`PUT` fallaban con `TypeError: Failed to fetch` — un bloqueo de CORS en el propio navegador, antes de que la petición llegara a la red.

**Causa raíz**: `apps/api/internal/httpmw/cors.go::PublicCORS` fijaba `Access-Control-Allow-Methods: "GET, POST, OPTIONS"` desde su creación (auth/rutas) — nunca se actualizó al añadir el primer endpoint `DELETE` real de la API (`almacenamiento-fotos-backend`). El preflight `OPTIONS` respondía sin `DELETE` en la lista permitida, así que el navegador rechazaba la petición real sin que llegara a tocar la red — invisible con `curl` directo (sin preflight) y con Cypress (su navegador no aplica CORS con el mismo rigor que un WebView Android real, por eso los 54/54 de la suite completa no lo detectaron).

**Corregido** añadiendo `DELETE` a `Access-Control-Allow-Methods` (`apps/api/internal/httpmw/cors.go`), con test de regresión nuevo (`cors_test.go`) que exige `DELETE` en la respuesta al preflight de `/api/routes/{id}/photos/{photoId}`. Reverificado end-to-end en el mismo dispositivo tras redesplegar el backend localmente: subida y borrado de una foto real de cámara, cifrado/descifrado correcto, y el escenario sin conexión (modo avión + túnel `adb reverse` cortado) sin bloquear la UI ni perder el cambio local.

Este cambio toca `apps/api` pese a que la propuesta original decía "sin cambios en apps/api" — corrección deliberada del propio artefacto tras el hallazgo (ver proposal.md, Impact).
