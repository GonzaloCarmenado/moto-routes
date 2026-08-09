## 1. Infraestructura HTTP compartida

- [x] 1.1 Tests de `external-api.service.spec.ts` (rojo) para los dos casos nuevos de `fetchJson`: `method: 'DELETE'`, body `FormData` (no se serializa a JSON ni se fija `Content-Type`), y respuesta sin cuerpo (`204` o sin `Content-Length`) resuelta como `undefined` en vez de lanzar por JSON inválido.
- [x] 1.2 Test de regresión explícito: las llamadas existentes (auth, catálogo de tipos de parada, rutas en la nube) con `body` JSON normal y respuesta con cuerpo siguen comportándose igual.
- [x] 1.3 Implementar los cambios en `fetchJson`/`FetchJsonOptions` (`external-api.service.ts`) hasta verde.

## 2. Cliente HTTP de fotos en la nube

- [x] 2.1 Tests de `photo-cloud-api.service.spec.ts` (rojo): `uploadRoutePhoto` construye el `FormData` correcto (campo `photo` + `latitude`/`longitude`/`captured_at` opcionales) y devuelve el `Photo` remoto parseado; `deleteRoutePhoto` llama `DELETE .../{photoId}` y no lanza en éxito (`204`).
- [x] 2.2 Tests de clasificación de error (`PhotoCloudApiError`): `401` → `unauthorized`, `404` → `not-found`, `400` con mensaje de tamaño → `too-large`, `400` con mensaje de límite de fotos → `too-many-photos`, fallo de red → `network`.
- [x] 2.3 Implementar `photo-cloud-api.service.ts` (`apps/mobile/src/shared/http/`) hasta verde, siguiendo el patrón de `route-cloud-api.service.ts`.

## 3. Modelo de datos: estado remoto de una foto

- [x] 3.1 Añadir `remotePhotoId: string | null` a `Photo` (`photo.types.ts`) y el método `markPhotoSynced(photoId: string, remotePhotoId: string): Promise<void>` a `IPhotoRepository`.
- [x] 3.2 Test (rojo) de `MemoryPhotoRepository.markPhotoSynced` y de que `add()` inicializa `remotePhotoId: null`; implementar hasta verde.
- [x] 3.3 Test (rojo) de `SqlitePhotoRepository`: migración condicional de la columna `remote_photo_id` (vía `PRAGMA table_info` + `ALTER TABLE`) sobre una base de datos ya existente con fotos previas, sin perder filas; `markPhotoSynced` persiste y `getByRouteId`/`getById` devuelven el campo. Implementar hasta verde.

## 4. Orquestación de subida/borrado de foto

- [x] 4.1 Test (rojo) de una función que lee los bytes de una foto desde `filePath` (Tauri: `readFile`; navegador: `fetch(dataUrl).then(r => r.blob())`) y construye el `File`/`Blob` a subir; implementar hasta verde.
- [x] 4.2 Test (rojo) de `uploadPhotoToCloud(...)`: sube la foto, en éxito llama `markPhotoSynced`, en fallo no lanza (mismo criterio que `autoResyncIfNeeded`) y muestra un aviso discreto — nunca revierte el guardado local. Implementar hasta verde.
- [x] 4.3 Test (rojo) de `deletePhotoFromCloud(...)`: con `remotePhotoId` no nulo llama al `DELETE` remoto; con `remotePhotoId` nulo no hace ninguna llamada de red; en fallo no lanza, solo aviso discreto. Implementar hasta verde.
- [x] 4.4 Test (rojo) de que ambas funciones son no-op si la ruta no está sincronizada (mismo criterio que `autoResyncIfNeeded`). Implementar hasta verde.

## 5. Integración en `route-detail.element.ts`

- [x] 5.1 Test (rojo) de `handleAddPhoto`: en una ruta sincronizada, tras persistir la foto localmente también se dispara la subida en segundo plano (sin bloquear el `finally` que quita el `loading`); en una ruta puramente local no se dispara ninguna llamada.
- [x] 5.2 Sustituir el primer `// TODO` (línea ~433) por la llamada real a `uploadPhotoToCloud`, capturando el `File`/ruta de cada foto añadida.
- [x] 5.3 Test (rojo) de `handleDeletePhoto`: en una ruta sincronizada, el `remotePhotoId` de la foto se captura **antes** de borrar la fila local (Decisión 5 de design.md) y se usa para el borrado remoto en segundo plano.
- [x] 5.4 Sustituir el segundo `// TODO` (línea ~508) por la llamada real a `deletePhotoFromCloud`.
- [x] 5.5 (no planeada) `persistCapturedPhoto`/`addPhotoToRoute` devolvían el `CreatePhoto` de entrada en vez de la entidad `Photo` real persistida (sin `id`) — corregido para poder referenciar la foto subida al marcarla sincronizada.
- [x] 5.6 (no planeada) Extraídos `triggerAutoResync`/`triggerPhotoUpload`/`triggerPhotoDelete` a `route-detail-sync-triggers.ts` (funciones puras + tests propios) — `route-detail.element.ts` superaba su límite de tamaño (`max-lines`, incluso con la excepción a 400 ya existente para este fichero).

## 6. E2E Cypress contra el backend real

- [x] 6.1 Nuevo spec `cypress/e2e/routes/route-photo-sync.cy.ts`: añadir una foto a una ruta sincronizada, verificar (vía la propia API) que la foto existe en el servidor; borrarla y verificar que desaparece (espera determinista con `cy.intercept`/`cy.wait`, no timeouts fijos).
- [x] 6.2 Escenario de foto añadida a una ruta puramente local: verificado que no se realiza ninguna llamada a `/api/routes/*/photos` (`cy.intercept`).
- [x] 6.3 (no planeada) Dos bugs reales encontrados verificando contra el backend real, ninguno visible en Vitest: (1) `readPhotoBlob` usaba `fetch()` sobre un `data:` URL en navegador — el CSP de `index.html` (`connect-src`) no incluye `data:`, así que quedaba bloqueado en silencio; corregido decodificando el `data:` URL a mano (`atob`), sin tocar el CSP. (2) `this._photos` (memoria del componente) no se actualizaba cuando la subida en segundo plano terminaba y marcaba la foto como sincronizada en el repositorio — un borrado posterior seguía viendo `remotePhotoId: null` y nunca llegaba a borrar la copia remota; corregido con `syncPhotoRemoteState()`, que refresca esa foto en memoria cuando la subida termina.
- [x] 6.4 (no planeada) Suite completa de Cypress (54/54, 10 specs) reejecutada contra el backend real tras los fixes — sin regresiones.

## 7. Verificación en dispositivo Android real

- [x] 7.1 Build completo (no atajo Gradle-only, ver gotcha de `rutas-en-la-nube` en memory/context.md) e instalación en dispositivo real. Gotchas nuevos encontrados y resueltos: JBR de Android Studio autoactualizado a Java 25 (mismo gotcha ya documentado, `JAVA_HOME` a `jdk-24`) y hash del JS empaquetado desactualizado en el primer build (mismo procedimiento ya documentado: copiar `dist/` a mano + segundo build completo). Verificado con CDP (`document.querySelector('script').src`), no solo `unzip`.
- [x] 7.2 Verificado con cámara real (foto real de 2.5MB, EXIF con modelo de dispositivo) en una ruta ya sincronizada: aparece en el servidor, cifrado/descifrado correcto byte a byte. Galería con selección múltiple: **bloqueada por un error de permisos de Tauri, no relacionado con este cambio** (anotado para investigar aparte, no bloqueante para esta spec).
- [x] 7.3 Verificado borrado de una foto sincronizada: desaparece del servidor — solo tras encontrar y corregir un bug real (ver 7.5).
- [x] 7.4 Verificado el escenario sin conexión (modo avión + túnel `adb reverse` cortado para simular offline real): añadir y borrar fotos no bloquea la UI ni pierde el cambio local (`remotePhotoId` queda `null`, la foto sigue visible); borrar una foto nunca subida no intenta ninguna llamada de red. Un error nativo de Tauri ("route not found") apareció durante la prueba pero confirmado por el usuario como ajeno a esta spec.
- [x] 7.5 (no planeada) **Bug real encontrado en `apps/api`, no en `apps/mobile`**: el borrado de una foto sincronizada nunca llegaba al servidor desde el WebView Android real (sí desde Cypress, que no aplica CORS con el mismo rigor). Causa raíz: `httpmw.PublicCORS` nunca declaraba `DELETE` en `Access-Control-Allow-Methods`, así que el preflight real lo rechazaba antes de que la petición llegara a la red — invisible con `curl` directo (sin preflight) y con Cypress. Diagnosticado aislando con un `fetch()` crudo vía Chrome DevTools Protocol contra el WebView real. Corregido (`GET, POST, DELETE, OPTIONS`), con test de regresión nuevo en `cors_test.go`, backend redesplegado localmente y reverificado en el dispositivo real.

## 8. Cierre

- [x] 8.1 Revisar el diff completo buscando secretos — sin hallazgos. Limpiado además el diff de artefactos generados por el build de Android (`gen/android/.../assets/`) que se habían colado durante la verificación del Grupo 7.
- [x] 8.2 Actualizar `memory/context.md` con el estado final de este cambio.
- [x] 8.3 Evaluado: el gap de CORS (`DELETE` ausente en `Access-Control-Allow-Methods`) merece su propia ADR — es una decisión/incidente real de arquitectura (tercer gap del mismo tipo en `PublicCORS`, ver su comentario ya actualizado), no solo una corrección de detalle. Ver ADR-043 en `memory/decisions.md`.
- [x] 8.4 (no planeada, gate de revisión) Cerrado un hueco de cobertura real detectado en la propia revisión: los escenarios "rechazo por tamaño excesivo" y "rechazo por límite de fotos" solo estaban cubiertos por el test genérico de fallo de `uploadPhotoToCloud`, no por un test que reprodujera esos `kind` de error específicamente — añadidos ambos en `route-detail-cloud.service.spec.ts`.
