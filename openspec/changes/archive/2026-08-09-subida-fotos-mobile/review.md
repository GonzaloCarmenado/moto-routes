## CRÍTICO (leer primero)

- **Bug real de producción encontrado y corregido, fuera del alcance original de la propuesta**: verificando en un dispositivo Android real (WebView real, no el navegador de Cypress) con una foto de cámara real, el borrado de una foto sincronizada nunca llegaba al servidor — la foto desaparecía localmente pero quedaba huérfana en remoto para siempre. Causa raíz: `apps/api/internal/httpmw/cors.go::PublicCORS` nunca declaraba `DELETE` en `Access-Control-Allow-Methods`, así que el preflight real lo rechazaba antes de tocar la red. Invisible con `curl` directo (sin preflight) y con los 54/54 de Cypress (su navegador no aplica CORS con el mismo rigor que un WebView real). Diagnosticado aislando la causa con un `fetch()` crudo vía Chrome DevTools Protocol contra el WebView del dispositivo real — confirmado `GET`/`POST` funcionando y `DELETE`/`PUT` fallando con `TypeError: Failed to fetch` antes de tocar el código de la app. Corregido con test de regresión (`cors_test.go`), documentado en ADR-043 (`memory/decisions.md`), backend redesplegado localmente y reverificado end-to-end en el mismo dispositivo. `proposal.md`/`design.md` actualizados para reflejar que este cambio sí toca `apps/api`, pese a decir originalmente lo contrario.
- **Cambio en código compartido crítico**: `apps/mobile/src/shared/http/external-api.service.ts::fetchJson` (usado también por `auth-api.service.ts`, `route-cloud-api.service.ts`, catálogo de tipos de parada y vPIC) gana soporte para `method: 'DELETE'`, body `FormData` y respuestas sin cuerpo (`204`/`Content-Length: 0`). Los tres cambios son aditivos y solo se activan con `body instanceof FormData`, `method === 'DELETE'` o una respuesta realmente vacía — ninguna llamada existente pasa `FormData` ni recibe `204`, así que su comportamiento no cambia. Cubierto con test de regresión explícito (`external-api.service.spec.ts`) además de la suite completa de los cuatro consumidores en verde.
- **Sin secretos en el diff**: revisado explícitamente (patrones de credenciales/tokens/claves) sobre los ficheros modificados de este cambio — sin hallazgos. Los tokens/cuentas de prueba usados durante la verificación en el dispositivo real vivieron solo en comandos de shell efímeros y ficheros temporales, nunca en el repositorio; la cuenta de prueba se borró del servidor al terminar.
- **CSP no se ha tocado**: el primer intento de subida en navegador usaba `fetch()` sobre un `data:` URL, bloqueado en silencio porque `connect-src` no incluye `data:`. Se descartó deliberadamente añadir `data:` a la CSP — en su lugar, `readPhotoBlob` decodifica el `data:` URL a mano (`atob`), evitando tocar una superficie de seguridad para un problema que no lo requería.
- **Sin dependencias nuevas** (ni npm ni Go).
- **Verificación real, no solo simulada**: además de 965/965 Vitest (cobertura 96.38%/90.87%/94.4%/96.38%, statements/branches/functions/lines), 113/113 Go y 54/54 Cypress contra backend real, se verificó en un dispositivo Android físico con una foto de cámara real (2.5MB, EXIF con modelo de dispositivo): subida con cifrado/descifrado byte a byte correcto, borrado confirmado contra el servidor, y el escenario sin conexión (modo avión + túnel `adb reverse` cortado para simular offline real, no solo el radio del teléfono) sin bloquear la UI ni perder el cambio local.
- **Gap ajeno a este cambio, no bloqueante**: subir una foto desde la galería (selección múltiple) en el dispositivo real da un error de permisos propio de Tauri — la cámara funciona con normalidad. Documentado en `memory/context.md` como pendiente de investigar aparte; no forma parte del alcance de esta spec (que ya funcionaba así, sin cambios de este cambio en el flujo de selección de archivo).

## Cobertura Requirement → Scenario → Test

| Requirement | Scenario | Test(s) | Estado |
|---|---|---|---|
| Una ruta ya sincronizada se actualiza sola al modificarla (metadatos) | Guardar una nota la re-sube sola | `route-detail.element.spec.ts` ("guardar una nota en una ruta ya sincronizada dispara una re-subida...") — sin cambios, requisito preexistente | ✅ |
| | Añadir una foto sube también la foto | `route-detail.element.spec.ts` ("añadir una foto... dispara su subida además de la re-subida de metadatos"), `route-detail-sync-triggers.spec.ts` (`triggerPhotoUpload`), `route-detail-cloud.service.spec.ts` (`uploadPhotoToCloud`); `route-photo-sync.cy.ts` (E2E real); **verificado en dispositivo Android real con foto de cámara** | ✅ |
| | Borrar una foto la borra también de la nube | `route-detail.element.spec.ts` ("borrar una foto ya subida... la borra también de la nube"), `route-detail-sync-triggers.spec.ts` (`triggerPhotoDelete`), `route-detail-cloud.service.spec.ts` (`deletePhotoFromCloud`); `route-photo-sync.cy.ts` (E2E real); **verificado en dispositivo Android real, incluido el bug de CORS encontrado y corregido durante esta misma verificación** | ✅ |
| | Modificar una ruta puramente local no la sube | `route-detail.element.spec.ts` ("...delega en uploadPhotoToCloud con isSynced false"), `route-detail-cloud.service.spec.ts` (`uploadPhotoToCloud`/`deletePhotoFromCloud` "si la ruta no está sincronizada, no hace nada"); `route-photo-sync.cy.ts` ("no llama nunca al backend de fotos") | ✅ |
| | Un fallo de subida/borrado de foto no bloquea ni deshace el cambio local | `route-detail-cloud.service.spec.ts` (`uploadPhotoToCloud`/`deletePhotoFromCloud` "si la subida/el borrado falla..."); **verificado en dispositivo real con el escenario sin conexión real** (modo avión + `adb reverse` cortado) | ✅ |
| Los límites del backend de fotos se respetan al subir | Rechazo por tamaño excesivo | `route-detail-cloud.service.spec.ts` ("si el servidor rechaza la foto por tamaño excesivo...") — añadido durante esta revisión, ver Hallazgos | ✅ |
| | Rechazo por límite de fotos de la ruta | `route-detail-cloud.service.spec.ts` ("si el servidor rechaza la foto porque la ruta ya alcanzó el máximo...") — añadido durante esta revisión | ✅ |
| Borrar una foto que nunca llegó a subirse no produce error | Borrar una foto guardada sin conexión que nunca se subió | `route-detail-cloud.service.spec.ts` (`deletePhotoFromCloud` "si la foto nunca se subió (remotePhotoId null)..."), `route-detail.element.spec.ts` ("...delega en deletePhotoFromCloud con remotePhotoId null"); **verificado en dispositivo real** (borrar, sin conexión, una foto añadida offline) | ✅ |

**9/9 escenarios del delta spec cubiertos por test** (unitarios + integración + E2E Cypress contra backend real), 6 de ellos además verificados manualmente en un dispositivo Android físico con datos reales (no solo simulados).

## Hallazgos

### Gap (corregido durante esta revisión)
- Los dos escenarios de límites del backend (tamaño excesivo / máximo de fotos) solo estaban cubiertos por el test genérico de fallo de `uploadPhotoToCloud` (mismo camino de código, `catch` sin distinguir `kind` de error) — no había un test que reprodujera esos `kind` específicos. Añadidos ambos en `route-detail-cloud.service.spec.ts` antes de cerrar esta revisión.

### Desviación
- `design.md` (Decisión 3) describía inicialmente "decodifica el `data:` URL con `fetch()`" para el caso navegador de `readPhotoBlob` — cambiado a decodificación manual (`atob`) tras encontrar que el CSP bloquea `fetch()` sobre `data:`. Desviación ya documentada en el propio `design.md` ("Gap real encontrado verificando..."), no un cambio silencioso.
- La propuesta original decía explícitamente "sin cambios en `apps/api`" — invalidado por el hallazgo de CORS (ver CRÍTICO). Corregido en `proposal.md`/`design.md`, no dejado desalineado.

### Calidad
- `route-detail.element.ts` se acercaba a su límite de tamaño (`max-lines`, con la excepción ya existente a 400) — los tres "triggers" de sincronización en segundo plano se extrajeron a `route-detail-sync-triggers.ts` como funciones puras, con su propio test de la guarda (sesión/routeId), en vez de forzar el límite o desactivar la regla.
- `persistCapturedPhoto`/`addPhotoToRoute` tenían un bug latente preexistente (devolvían los metadatos de entrada en vez de la entidad `Photo` real persistida, sin `id`) que este cambio necesitaba corregir para poder referenciar la foto subida — corregido con su propio test, sin ampliar el alcance más allá de lo necesario.
- `syncPhotoRemoteState` (mantener `_photos` en memoria al día tras una subida en segundo plano) se extrajo a `route-detail-photo.service.ts` en vez de vivir como método privado del componente, siguiendo el mismo criterio de tamaño/testabilidad que los triggers.

### Cobertura
- Sin gaps restantes tras el fix de esta revisión. 965/965 Vitest, cobertura 96.38%/90.87%/94.4%/96.38% (statements/branches/functions/lines), muy por encima del umbral del proyecto (80%).

### Convenciones de proyecto
- Sin `data-cy` nuevos que añadir — este cambio reutiliza elementos interactivos ya existentes (`photo-add-button`, `photo-thumbnail`, `photo-viewer-delete`), no introduce ninguno.
- JSDoc conciso presente en todos los símbolos exportados nuevos — cobertura de documentación del proyecto 71% (umbral 70%), sin advertencias nuevas atribuibles a este cambio (las 4 preexistentes son de otros dominios).
- Estructura por dominio respetada: HTTP en `shared/http/`, orquestación en `routes/detail/`, sin duplicar nada ya existente en `shared/`.
- Prosa en español, `Requirement`/`Scenario`/`WHEN`/`THEN` en inglés — consistente en la spec delta.

## Veredicto

**APPROVED**

Los 9 escenarios del delta spec están cubiertos por test, con verificación real (no solo simulada) en tres capas: 965/965 Vitest, 113/113 Go, 54/54 Cypress contra backend real, y verificación manual en un dispositivo Android físico con una foto de cámara real (cifrado/descifrado confirmado byte a byte, escenario sin conexión real). Esa misma verificación en dispositivo real encontró y corrigió un bug genuino de producción (CORS sin `DELETE`) que ninguna de las otras capas de test podía detectar — corregido, documentado en ADR-043, y reverificado. El único gap de cobertura encontrado durante esta revisión (límites del backend sin test específico) se cerró en el momento. Sin hallazgos de seguridad pendientes, sin secretos en el diff, sin dependencias nuevas.
