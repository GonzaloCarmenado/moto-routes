# Feature: Cobertura E2E real con Cypress

## Descripción
Hoy la cobertura E2E del proyecto es prácticamente nula: Cypress está instalado pero solo existe un spec (`cockpit.cy.ts`, 4 tests), roto porque testea el toggle "Modo Invisible" (retirado el 2026-07-27) y usa un selector CSS en vez de `data-cy`; además no hay scripts npm para ejecutar Cypress. Esta spec repara ese spec, añade el andamiaje mínimo que falta (scripts npm, mecanismo de siembra de datos de prueba) y amplía la cobertura E2E a los flujos principales de la app ya implementados: cockpit (grabación), listado de rutas, detalle de ruta, fotos y timeline. El contenido de la issue #42 ("fotos-ruta Paso 11: Tests E2E") queda absorbido aquí en vez de abordarse por separado.

**Fuera de alcance explícito**: montar un workflow de CI (`.github/workflows/`) — se deja para una spec/decisión posterior.

## Criterios de Aceptación

### Reparación del spec roto y scripts npm
- [x] AC-001: `cypress/e2e/cockpit/cockpit.cy.ts` ya no contiene ningún test sobre "Modo Invisible" (funcionalidad retirada del código).
- [x] AC-002: `cypress/e2e/cockpit/cockpit.cy.ts` ya no usa el selector CSS `.speed-display .speed-value`; usa en su lugar `[data-cy="cockpit-speed-value"]`.
- [x] AC-003: `buildSpeedDisplay()` (`src/cockpit/cockpit.render.ts`) añade `data-cy="cockpit-speed-value"` al nodo `.speed-value` que muestra el valor numérico de velocidad (hoy sin ningún `data-cy`).
- [x] AC-004: Ejecutando `cy:run` (o `cy:open`) contra `cockpit.cy.ts` reparado, los 3 escenarios que quedan (estado inicial del botón maestro y velocidad a 0, cambio a "finalizar" al grabar, botón de pausa habilitado al grabar) pasan en verde contra el código actual, sin modificar más contenido del que exige este AC.
- [x] AC-005: `package.json` incluye los scripts npm `cy:open` (Cypress interactivo), `cy:run` (Cypress en modo headless) y `test:e2e` (levanta el servidor de desarrollo y ejecuta `cy:run`, terminando el servidor al acabar).
- [x] AC-006: `start-server-and-test` está declarado como `devDependency` en `package.json` (no estaba presente).

### Mecanismo de siembra de rutas para tests (solo entorno navegador/desarrollo)
- [x] AC-007: Cuando `isTauri()` (la función ya existente en `src/shared/services/photo-capture-adapter.service.ts`, única fuente de verdad de detección de entorno en el proyecto) devuelve `false`, `app.element.ts` comprueba, antes de renderizar, si existe la clave `cypress-seed-routes` en `localStorage`.
- [x] AC-008: Si esa clave contiene un JSON válido con la forma `{ routes: Route[]; points?: Record<string, RoutePoint[]>; stops?: Record<string, RouteStop[]> }` (usando los tipos ya existentes en `shared/models/route.types.ts`), cada ruta listada (y sus puntos/paradas asociados, si se incluyen) queda precargada en el `MemoryRouteRepository` **antes** de que `<cockpit-view>`, `<route-list>` y `<route-detail>` reciban el repositorio — de modo que aparecen como rutas ya guardadas sin haber pasado por la UI de grabación.
- [x] AC-009: Si la clave `cypress-seed-routes` no existe, contiene JSON inválido, o no tiene al menos un array `routes`, la aplicación arranca exactamente igual que hoy (repositorio en memoria vacío), sin ningún error visible para el usuario ni bloqueo del renderizado.
- [x] AC-010: Cuando `isTauri()` devuelve `true` (Android empaquetado o desktop), el mecanismo de siembra **nunca** se ejecuta ni se lee `localStorage` con este propósito, sin importar si la clave `cypress-seed-routes` existiera en ese entorno.
- [x] AC-011: La lógica que interpreta el JSON de `cypress-seed-routes` y lo vuelca en el repositorio es una función aislada (sin depender del DOM ni de Cypress) con su propia cobertura de tests Vitest, cubriendo al menos: JSON válido con rutas+puntos+paradas, clave ausente, JSON corrupto, y `routes` vacío.

### Siembra de fotos para tests (reutilizando el mecanismo ya existente)
- [x] AC-012: Queda documentado (sin implementar mecanismo nuevo) que los tests de Cypress siembran fotos asociadas a una ruta sembrada escribiendo directamente un array de `Photo[]` (forma ya existente en `shared/models/photo.types.ts`) en la clave real `moto-routes-photos` de `localStorage` — la misma que ya lee `MemoryPhotoRepository` en cada instancia nueva — antes de `cy.visit('/')`.

### Flujo cockpit: grabación
- [x] AC-013: Al visitar `/` sin ninguna grabación en curso, `[data-cy="cockpit-master-btn"]` tiene `aria-label="Iniciar grabación"` y `[data-cy="cockpit-speed-value"]` muestra `0`.
- [x] AC-014: Al pulsar `[data-cy="cockpit-master-btn"]` estando en reposo, cambia a `aria-label="Mantén pulsado para finalizar la ruta"` y `[data-cy="cockpit-pause-btn"]` queda habilitado con `aria-label="Pausar ruta"`.
- [x] AC-015: Durante una grabación activa, pulsar `[data-cy="cockpit-pause-btn"]` cambia su `aria-label` a "Reanudar ruta"; al volver a pulsarlo, cambia de nuevo a "Pausar ruta".
- [x] AC-016: Manteniendo pulsado `[data-cy="cockpit-master-btn"]` durante una grabación activa el tiempo configurado (long-press), se abre el diálogo `cockpit-save-route-dialog` con el campo `[data-cy="save-route-dialog-input-name"]` visible.
- [x] AC-017: Escribiendo un nombre en `[data-cy="save-route-dialog-input-name"]` y pulsando `[data-cy="save-route-dialog-action-save"]`, el diálogo se cierra, aparece un toast con el texto "Ruta guardada" y `[data-cy="cockpit-master-btn"]` vuelve a `aria-label="Iniciar grabación"`.
- [x] AC-018: Pulsando `[data-cy="save-route-dialog-action-discard"]` en lugar de guardar, aparece un toast con el texto "Ruta descartada", no se crea ninguna ruta nueva visible en el listado, y `[data-cy="cockpit-master-btn"]` vuelve igualmente a `aria-label="Iniciar grabación"`.

### Flujo route-list
- [x] AC-019: Con N rutas sembradas vía `cypress-seed-routes` y navegando a "Rutas" (`[data-cy="nav-rutas"]`), se muestran exactamente N elementos `[data-cy="route-card"]`, cada uno mostrando el nombre y la fecha de su ruta correspondiente.
- [x] AC-020: Sin ninguna ruta sembrada, al navegar a "Rutas" se muestra `[data-cy="route-list-empty"]` con el texto "No hay rutas guardadas todavía", y no aparece ningún `[data-cy="route-card"]`.
- [x] AC-021: Pulsando `[data-cy="route-card-btn-eliminar"]` de una tarjeta y confirmando en `[data-cy="confirm-dialog-action-confirm"]`, esa tarjeta desaparece del listado y aparece un toast con el texto "Ruta eliminada".
- [x] AC-022: Pulsando `[data-cy="route-card-btn-eliminar"]` y cancelando en `[data-cy="confirm-dialog-action-cancel"]`, la tarjeta sigue presente en el listado sin cambios.

### Flujo route-detail
- [x] AC-023: Pulsando sobre un `[data-cy="route-card"]` sembrado, se navega al detalle de esa ruta: se muestra su nombre como título y el contenedor del mapa `[data-cy="route-map-container"]`.
- [x] AC-024: En el detalle de una ruta, pulsar cada botón de `<tab-bar>` (`[data-cy="tab-bar-btn-fotos"]`, `-estadisticas`, `-notas`, `-timeline`) muestra su panel correspondiente sin recargar los datos de la ruta (no hay una nueva petición al repositorio al cambiar de pestaña).
- [x] AC-025: En la pestaña "Notas" de una ruta sembrada con `notes: null`, se muestra directamente el área editable `[data-cy="route-detail-textarea-notas"]` (modo edición, no modo vista).
- [x] AC-026: Escribiendo texto en `[data-cy="route-detail-textarea-notas"]` y pulsando `[data-cy="route-detail-btn-guardar-nota"]`, aparece un toast "Nota guardada" y la vista pasa a modo lectura, mostrando `[data-cy="route-detail-texto-nota"]` con el texto recién guardado.
- [x] AC-027: En una ruta sembrada con `notes` no vacío, la pestaña "Notas" muestra directamente el modo vista (`[data-cy="route-detail-texto-nota"]` + `[data-cy="route-detail-btn-editar-nota"]`), sin pasar por el área editable.
- [x] AC-028: Pulsando `[data-cy="route-detail-btn-editar-nota"]` sobre una nota ya existente, aparece `[data-cy="route-detail-textarea-notas"]` con el texto actual precargado.

### Flujo fotos
- [x] AC-029: En la pestaña "Fotos" de una ruta sembrada sin ninguna foto, se muestra `[data-cy="photo-placeholder"]` con el texto "Sin fotos", y no aparece ningún `[data-cy="photo-thumbnail"]`.
- [x] AC-030: Pulsando `[data-cy="photo-add-button"]` → `[data-cy="photo-menu-camera"]` y seleccionando un archivo de imagen (vía `cy.selectFile()` sobre el input interceptado), la foto se persiste y aparece una nueva `[data-cy="photo-thumbnail"]` en la galería.
- [x] AC-031: Pulsando `[data-cy="photo-add-button"]` → `[data-cy="photo-menu-gallery"]` y seleccionando varios archivos a la vez, se añaden todas las fotos seleccionadas como miniaturas nuevas (una `[data-cy="photo-thumbnail"]` por archivo).
- [x] AC-032: Pulsando una `[data-cy="photo-thumbnail"]`, se abre el visor de fotos a pantalla completa mostrando esa imagen.
- [x] AC-033: Pulsando `[data-cy="photo-viewer-close"]` con el visor abierto, este se cierra y se vuelve a la galería en cuadrícula.
- [x] AC-034: Si la ruta sembrada tiene puntos GPS y al menos una foto con coordenadas propias, el mapa del detalle muestra al menos un marcador (`[data-cy="photo-marker"]` o `[data-cy="photo-cluster"]`, según agrupación).

### Flujo timeline
- [x] AC-035: En la pestaña "Timeline" de una ruta sembrada con puntos GPS suficientes y sin ninguna parada detectable, se muestran en orden cronológico un evento de Salida (`[data-cy="route-detail-timeline-evento-salida"]`) seguido de un evento de Llegada (`[data-cy="route-detail-timeline-evento-llegada"]`).
- [x] AC-036: Si la ruta sembrada incluye fotos (vía `moto-routes-photos`) con `capturedAt` dentro del rango temporal de la ruta, aparece un evento `[data-cy="route-detail-timeline-evento-foto-{id}"]` en la posición cronológica correspondiente dentro de la Timeline.
- [x] AC-037: En una ruta sembrada sin puntos GPS y sin fotos, la pestaña "Timeline" muestra el estado vacío `[data-cy="route-detail-timeline-vacio"]`.

### Nuevos `data-cy` requeridos para poder cubrir lo anterior
- [x] AC-038: El `<input type="file">` que crea internamente `captureFromInput()` (`src/shared/services/photo-capture-adapter.service.ts`, usado por `captureFromCamera()`/`pickFromGallery()`) se adjunta temporalmente al DOM (oculto, sin alterar el layout visible) con `data-cy="photo-capture-input-file"` mientras espera la selección del usuario, y se retira del DOM al resolver (con archivos elegidos o cancelación) — sin cambiar su comportamiento actual en producción (sigue funcionando igual en web y en el WebView de Android).
- [x] AC-039: El contenedor completo y clicable de cada tarjeta de `<route-list>` (hoy sin `data-cy` propio, solo sus botones internos lo tienen) lleva `data-cy="route-card"`.
- [x] AC-040: El estado vacío de `<route-list>` ("No hay rutas guardadas todavía", hoy sin `data-cy`) lleva `data-cy="route-list-empty"`.

### Límite de 100 fotos por ruta (comportamiento NUEVO — no solo cobertura de test)
`specs/features/fotos-ruta.md` documenta desde su creación, como Constraint, un límite de 100 fotos por ruta con el botón "Añadir foto" deshabilitándose al alcanzarlo. Auditado el código actual: `countByRouteId()` existe en `IPhotoRepository` (`SqlitePhotoRepository`/`MemoryPhotoRepository`) con tests de contrato propios, pero ningún componente de UI lo invoca ni ninguna otra vía; tanto `<route-detail>` (`this._photos`, poblado por `photoRepo.getByRouteId()`) como `<cockpit-view>` (`this.galleryEl.photos`, poblado por `fetchGalleryPhotos()`) ya cargan el array completo de fotos de la ruta, así que el conteo real está disponible en ambos sitios aunque `countByRouteId()` nunca se llame. `PhotoCaptureElement.disabled` es una propiedad ya existente (`get`/`set disabled`, con reflejo a atributo y a `aria-label`/estado del botón interno) pero, hasta esta spec, ningún llamador la asigna nunca — por eso el botón nunca se deshabilita por conteo de fotos, decisión ahora explícita: se implementa.
- [x] AC-041: Al cargar/refrescar la lista de fotos de una ruta (montaje inicial de la pestaña "Fotos" de `<route-detail>`, o refresco de la galería del cockpit durante una grabación activa — mismo array ya obtenido vía `getByRouteId()`/`fetchGalleryPhotos()`, sin necesidad de invocar `countByRouteId()` por separado), si esa ruta tiene **100 fotos o más**, el componente padre asigna `disabled = true` sobre la instancia de `<photo-capture>` correspondiente, reflejándose en el DOM como `[data-cy="photo-add-button"]` con el atributo `disabled` presente.
- [x] AC-042: Cuando se cumple la condición de AC-041, `[data-cy="photo-add-button"]` expone además un texto accesible distinto del habitual "Añadir foto" (`aria-label`/`title`) que comunica el motivo, p.ej. "Límite de fotos alcanzado" (mismo texto ya documentado en el Constraint de `fotos-ruta.md`) — diferenciable del estado transitorio "cargando" (`loading`) que el componente ya soporta.
- [x] AC-043: Con menos de 100 fotos (p. ej. 99), `[data-cy="photo-add-button"]` no lleva el atributo `disabled` y conserva `aria-label="Añadir foto"`.
- [x] AC-044: Si el usuario añade una foto que hace pasar el conteo de 99 a 100 fotos (dentro de la misma sesión de la pestaña "Fotos"/cockpit, sin recargar ni renavegar), `[data-cy="photo-add-button"]` pasa a `disabled` inmediatamente tras esa operación, con el mismo recuento recalculado en el momento (no solo al montar el componente).
- [x] AC-045: Si el usuario elimina una foto de una ruta que tenía exactamente 100 (quedando en 99), `[data-cy="photo-add-button"]` se rehabilita automáticamente (pierde el atributo `disabled` y vuelve a `aria-label="Añadir foto"`) en la misma sesión, sin recargar la página.

## Comportamiento Esperado

### Escenario: Ejecutar la suite de cockpit reparada (Happy Path)
- **Dado** el spec `cockpit.cy.ts` reparado (sin el test de Modo Invisible, con `[data-cy="cockpit-speed-value"]` en vez del selector CSS) y el servidor de desarrollo levantado
- **Cuando** se ejecuta `pnpm run cy:run` (o `pnpm run test:e2e`)
- **Entonces** los 3 tests del spec pasan en verde

### Escenario: Sembrar rutas para un test sin pasar por la UI de grabación
- **Dado** que un test escribe en `localStorage` la clave `cypress-seed-routes` con un JSON de 2 rutas antes de `cy.visit('/')`
- **Cuando** la app arranca fuera de Tauri
- **Entonces** ambas rutas aparecen ya guardadas al navegar a "Rutas", sin haber grabado nada

### Escenario: Arrancar sin datos de siembra
- **Dado** que `localStorage` no tiene la clave `cypress-seed-routes`
- **Cuando** la app arranca
- **Entonces** el listado de rutas aparece vacío (`[data-cy="route-list-empty"]`), sin ningún error

### Escenario: El mecanismo de siembra nunca se activa en Tauri
- **Dado** un entorno donde `isTauri()` devuelve `true` (Android empaquetado)
- **Cuando** la app arranca, aunque exista por error la clave `cypress-seed-routes` en su `localStorage`
- **Entonces** esa clave se ignora por completo y el repositorio usado es el real (SQLite), no el de memoria sembrado

### Escenario: Grabar, pausar, reanudar y guardar una ruta (Happy Path cockpit)
- **Dado** que el usuario está en la vista de grabación sin ninguna ruta en curso
- **Cuando** pulsa "Grabar", luego "Pausar", luego "Reanudar", y finalmente mantiene pulsado el botón maestro el tiempo de long-press y elige "Guardar" con un nombre
- **Entonces** ve el toast "Ruta guardada" y el botón maestro vuelve a su estado inicial

### Escenario: Descartar una ruta al finalizar
- **Dado** que el usuario tiene una grabación activa
- **Cuando** completa el long-press de parada y elige "Descartar"
- **Entonces** ve el toast "Ruta descartada" y no aparece ninguna ruta nueva en el listado

### Escenario: Listado con rutas sembradas
- **Dado** 3 rutas sembradas vía `cypress-seed-routes`
- **Cuando** el usuario navega a "Rutas"
- **Entonces** ve exactamente 3 tarjetas `[data-cy="route-card"]` con sus nombres y fechas correctos

### Escenario: Eliminar una ruta con confirmación
- **Dado** una ruta sembrada visible en el listado
- **Cuando** el usuario pulsa "Eliminar" en su tarjeta y confirma en el diálogo
- **Entonces** la tarjeta desaparece y aparece el toast "Ruta eliminada"

### Escenario: Cancelar la eliminación de una ruta
- **Dado** una ruta sembrada visible en el listado
- **Cuando** el usuario pulsa "Eliminar" en su tarjeta y cancela en el diálogo
- **Entonces** la tarjeta sigue visible sin cambios

### Escenario: Ver el detalle de una ruta sembrada y cambiar de pestaña
- **Dado** una ruta sembrada con puntos GPS
- **Cuando** el usuario pulsa su tarjeta y luego la pestaña "Timeline"
- **Entonces** ve el mapa de esa ruta y el contenido de la pestaña Timeline, sin recargar la ruta

### Escenario: Añadir una nota nueva a una ruta sin notas
- **Dado** una ruta sembrada con `notes: null`, en la pestaña "Notas"
- **Cuando** el usuario escribe un texto y pulsa "Guardar nota"
- **Entonces** ve el toast "Nota guardada" y la vista pasa a modo lectura con el texto guardado

### Escenario: Editar una nota ya existente
- **Dado** una ruta sembrada con una nota ya guardada, mostrada en modo vista
- **Cuando** el usuario pulsa el icono de editar, modifica el texto y pulsa "Guardar nota"
- **Entonces** la vista vuelve a modo lectura mostrando el texto actualizado

### Escenario: Sin fotos en una ruta (placeholder)
- **Dado** una ruta sembrada sin ninguna foto asociada
- **Cuando** el usuario abre la pestaña "Fotos"
- **Entonces** ve el mensaje "Sin fotos" y ningún elemento de galería

### Escenario: Añadir una foto desde la cámara (simulada con selectFile)
- **Dado** una ruta sembrada sin fotos, en la pestaña "Fotos"
- **Cuando** el usuario pulsa "Añadir foto" → "Cámara" y selecciona un archivo de imagen
- **Entonces** aparece una nueva miniatura en la galería

### Escenario: Añadir varias fotos desde la galería
- **Dado** una ruta sembrada sin fotos, en la pestaña "Fotos"
- **Cuando** el usuario pulsa "Añadir foto" → "Galería" y selecciona 3 archivos de imagen a la vez
- **Entonces** aparecen 3 miniaturas nuevas en la galería

### Escenario: Abrir y cerrar el visor de fotos (lightbox)
- **Dado** una ruta sembrada con al menos una foto
- **Cuando** el usuario pulsa una miniatura y luego el botón de cerrar del visor
- **Entonces** la foto se muestra a pantalla completa y, tras cerrar, se vuelve a la galería en cuadrícula

### Escenario: Timeline con salida, tramo y llegada
- **Dado** una ruta sembrada con puntos GPS que cubren un trayecto sin paradas
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve, en orden, el evento de Salida y el evento de Llegada

### Escenario: Timeline vacío sin datos GPS ni fotos
- **Dado** una ruta sembrada sin puntos GPS y sin fotos
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve el mensaje de estado vacío de la Timeline

### Escenario: El botón "Añadir foto" se deshabilita al alcanzar el límite de 100 fotos
- **Dado** una ruta sembrada con exactamente 100 fotos (sembradas vía la clave `moto-routes-photos`, sin necesidad de subirlas una a una)
- **Cuando** el usuario abre la pestaña "Fotos" de esa ruta
- **Entonces** `[data-cy="photo-add-button"]` aparece deshabilitado y con un texto accesible indicando que se alcanzó el límite

### Escenario: El botón permanece habilitado por debajo del límite
- **Dado** una ruta sembrada con 99 fotos
- **Cuando** el usuario abre la pestaña "Fotos" de esa ruta
- **Entonces** `[data-cy="photo-add-button"]` no está deshabilitado

### Escenario: El botón se deshabilita justo al añadir la foto número 100 en caliente
- **Dado** una ruta sembrada con 99 fotos, en la pestaña "Fotos", con el botón "Añadir foto" habilitado
- **Cuando** el usuario añade una foto más (la 100ª) vía "Añadir foto" → "Galería"
- **Entonces** el botón queda deshabilitado inmediatamente, sin recargar ni renavegar

### Escenario: El botón se rehabilita tras eliminar una foto por debajo del límite
- **Dado** una ruta sembrada con 100 fotos, con `[data-cy="photo-add-button"]` deshabilitado
- **Cuando** el usuario elimina una foto desde la galería (quedando en 99)
- **Entonces** el botón vuelve a estar habilitado, sin recargar la página

## Constraints
- Fuera de alcance: cualquier workflow de CI/GitHub Actions (`.github/workflows/`). Se aborda en una decisión/spec posterior.
- El contenido original previsto para la issue #42 ("fotos-ruta Paso 11: Tests E2E") queda absorbido íntegramente en esta spec; esa issue no se retoma como pieza separada.
- **Límite de 100 fotos por ruta — decisión explícita del usuario: SÍ se implementa aquí (AC-041 a AC-045)**. `specs/features/fotos-ruta.md` ya documentaba este límite como Constraint desde su creación, pero nunca estuvo implementado (`countByRouteId()` existía con tests de contrato sin ningún consumidor de UI; `PhotoCaptureElement.disabled` nunca se activaba por conteo). A diferencia del resto de AC de esta spec — que solo añaden cobertura E2E sobre comportamiento **ya existente** — AC-041 a AC-045 introducen **comportamiento nuevo** en `<route-detail>`/`<cockpit-view>` y posiblemente en `PhotoCaptureElement` (texto accesible al deshabilitar por límite), no solo sus tests. El detalle de implementación (dónde exactamente se recalcula el conteo, si se reutiliza `countByRouteId()` o el array ya cargado en memoria, y cómo se diferencia "deshabilitado por límite" de "deshabilitado por loading") se decide en la fase de plan — ver Notas de Implementación.
- El mecanismo de siembra de rutas (`cypress-seed-routes`) es exclusivo de entornos de test/desarrollo en navegador; queda excluido por diseño de cualquier build de producción Android/Tauri (AC-010).
- Todo elemento interactivo nuevo o modificado por esta spec (incluidos contenedores de estado vacío/error) lleva `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` ya usada en el proyecto.
- El mapa de `<route-detail>` depende de tiles remotos (OpenFreeMap); los tests de E2E de esta spec verifican la presencia de contenedor/marcadores en el DOM (`route-map-container`, `photo-marker`/`photo-cluster`), no la renderización visual completa del tile, para no depender de la disponibilidad de red del servicio externo.
- El long-press del botón maestro dura 1500 ms reales (`LONG_PRESS_MS` en `cockpit.element.ts`); los tests que lo ejercitan deben mantener el `pointerdown` ese tiempo real (no hay timers falseables desde Cypress sobre el propio navegador).

## Dependencias
- **`grabacion-rutas`**: cockpit, long-press de parada, diálogo de guardar/descartar.
- **`mejoras-guardado-rutas`**: `cockpit-save-route-dialog` (nombre de ruta), pestaña "Notas" de `route-detail`.
- **`fotos-ruta`**: `photo-capture`, `photo-gallery`, `photo-viewer`, marcadores de foto en `route-map`. El Constraint de esa spec ("máximo 100 fotos por ruta, botón deshabilitado con tooltip al alcanzarlo") pasa de "documentado pero no implementado" a **implementado y testeado en esta spec** (AC-041 a AC-045); no se abre un AC nuevo en `fotos-ruta.md` porque ese fichero ya lo recogía como Constraint desde el principio — esta spec cierra la brecha entre lo documentado y el código real, sin duplicar la especificación de la regla de negocio en dos sitios.
- **`timeline-ruta`**: pestaña "Timeline" de `route-detail`.
- **`mejoras-usabilidad`**: `<confirm-dialog>`, flujo de borrado de ruta (`deleteRouteAndPhotos`).
- **`reorganizar-dominios`**: rutas de importación actuales (`src/cockpit/`, `src/routes/list/`, `src/routes/detail/`, `src/shared/`) usadas al citar archivos concretos en esta spec.

## Notas de Implementación
- **Ubicación del hook de siembra**: en `src/app/app.element.ts`, dentro de `init()`, antes de la rama `try { createSqliteDb() } catch { new MemoryRouteRepository() }` — o justo después de instanciar el `MemoryRouteRepository` de fallback/por defecto, aplicando el seeding solo sobre esa instancia y solo cuando `isTauri()` es `false` (usar esa función ya existente como guarda explícita, no depender solo de que `createSqliteDb()` falle, para que el comportamiento sea determinista y no dependa de si por casualidad hay un plugin SQL cargable en el navegador de pruebas).
- **Capacidad nueva en `MemoryRouteRepository`**: para inyectar rutas/puntos/paradas ya "guardados" sin pasar por `save()` (que tiene lógica de upsert/orden de inserción pensada para el flujo normal de grabación), es razonable un método explícito de siembra (p. ej. `seed(routes, pointsByRouteId, stopsByRouteId)`) que puebla directamente sus `Map` internos preservando el orden esperado por `getAll()`. Detalle a decidir en la fase de plan.
- **Nombre de la clave de siembra**: `cypress-seed-routes`, tal y como se sugirió en el requisito original; no se ha encontrado colisión con ninguna clave de `localStorage` ya usada en el proyecto (`moto-routes-photos` es la única existente).
- **Input de archivo localizable (AC-038)**: hoy `captureFromInput()` crea el `<input type="file">`, le añade listeners y llama a `.click()` sin insertarlo nunca en el DOM — funciona en producción porque `.click()` sobre un elemento desconectado sigue abriendo el selector nativo, pero Cypress no puede localizar un elemento que no está en el árbol del documento. La solución debe mantener el comportamiento actual en producción (mismo flujo cámara/galería) y solo añadir la presencia temporal en el DOM + `data-cy` como mecanismo de localización para tests.
- **Localizar una tarjeta de ruta concreta en los tests**: en vez de depender de `data-route-id` (atributo interno ya existente, pero no es la convención `data-cy` del proyecto), se recomienda que los tests siembren cada ruta con un nombre único conocido y usen `cy.contains('[data-cy="route-card"]', '<nombre sembrado>')` para localizar la tarjeta concreta — coherente con "nunca seleccionar por ID/posición" de `docs/07-cypress-e2e.md`.
- **Límite de 100 fotos por ruta (AC-041 a AC-045)**: `<route-detail>` ya guarda el array completo de fotos en `this._photos` (poblado por `photoRepo.getByRouteId()`) y `<cockpit-view>` en `this.galleryEl.photos` (poblado por `fetchGalleryPhotos()`) — ambos sitios ya tienen el conteo disponible como `array.length` en cada punto donde hoy se refrescan tras añadir/eliminar (`refreshAllPanels()` en route-detail, `refreshGallery()`/filtrado directo en cockpit), sin necesidad de una llamada adicional a `countByRouteId()`. Usar `countByRouteId()` en su lugar sería una alternativa razonable si en el futuro se quisiera comprobar el límite sin cargar el array completo (p. ej. antes de decidir si merece la pena pedir todas las fotos), pero con el patrón actual de ambos componentes ya cargando todo el array, añadir una llamada aparte sería redundante — decisión final de cuál usar se deja a la fase de plan.
- Para diferenciar en el DOM el motivo de `disabled` ("límite alcanzado" vs. el `loading` transitorio que ya existe), es razonable que `PhotoCaptureElement` gane una propiedad/atributo adicional (p. ej. `limitReached: boolean`) en vez de sobrecargar la semántica de `disabled` para inferir qué texto mostrar — a decidir en plan, siguiendo el mismo patrón ya usado por `disabled`/`loading` (getter/setter + `toggleAttribute` + `attributeChangedCallback`).
- Para evitar que el número mágico "100" quede duplicado entre `route-detail.element.ts` y `cockpit.element.ts` (y diverja con el tiempo), conviene una constante compartida (p. ej. `MAX_PHOTOS_PER_ROUTE = 100`) en un módulo ya existente y neutral respecto a dominio — a decidir su ubicación exacta en plan (candidatos: junto a `IPhotoRepository`, o `shared/photo-capture/`).
- Patrón de referencia para deshabilitar botones con feedback coherente: `route-map-fullscreen.ts` (`createFullscreenToggle`) sincroniza `aria-label` según estado vía un único punto (`syncState()`); `PhotoCaptureElement` ya sigue un patrón equivalente con `updateButtonState()` para `disabled`/`loading` — cualquier adición debe integrarse ahí, no como lógica paralela.
