# Plan de Implementación: Mejoras de Usabilidad

## Resumen de Tareas
| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 0 | Fix de infraestructura: cascada de borrado real | `sqlite-route.repository.ts`, `sqlite-photo.repository.ts`, `photo-storage.service.ts`, `capabilities/default.json`, `route-deletion.service.ts` (+specs) | (prerrequisito de AC-005/008/009) | Medium |
| 1 | Módulo de feedback: `toast` + `confirm-dialog` | `shared/feedback/` (+specs) | AC-001, AC-002 | Medium |
| 2 | Guardar/descartar al parar ruta | `cockpit.service.ts`, `cockpit.element.ts` (+specs) | AC-003–006 | Large |
| 3 | Errores de foto consistentes (verificación) | cockpit/route-detail | AC-007 | Small |
| 4 | Confirmaciones destructivas (ruta y foto) | `route-list.element.ts`, `photo-gallery` | AC-008, AC-009 | Medium |
| 5 | Estados de carga y vacíos | `route-list`, `route-detail`, cockpit (guardar/descartar) | AC-010, AC-011 | Small |
| 6 | Galería y visor compartidos | `shared/photo-gallery/`, `shared/photo-viewer/`, `route-detail`, `cockpit` | AC-012–015 | Large |

Orden por dependencias: 0 antes que 2/4 (necesitan borrado real). 1 antes que 2/4 (usan `confirm-dialog`/`toast`). 6 puede ir en paralelo a 2–5, pero conviene dejarlo al final porque el cockpit necesitará mostrar la galería del Paso 6 dentro del flujo del Paso 2.

---

## Paso 0: Fix de infraestructura — el borrado en cascada no funciona hoy
- **Objetivo**: Antes de esta spec, `IRouteRepository.delete()`/`IPhotoRepository.delete()` nunca se llamaban desde ninguna pantalla — solo los ejercitan los tests de contrato con un mock de `SqlDb` (no SQLite real). El esquema declara `ON DELETE CASCADE`, pero SQLite tiene `foreign_keys` en `OFF` por defecto y la app nunca activa ese pragma: en producción (Android), borrar una ruta dejaría huérfanos sus `route_points`/`route_stops`/`photos`. Como esta spec activa el borrado real por primera vez, hay que arreglarlo aquí, no dejarlo para descubrirlo con datos reales perdidos.
- **AC cubiertos**: Ninguno directamente — es prerrequisito de AC-005, AC-008, AC-009.
- **Tests a escribir** (primero):
  - Test: `deleteRouteAndPhotos` borra la ruta, sus fotos (fila + intenta borrar el archivo) y no dejan rastro en `getAll()`/`getByRouteId()` tras la operación, contra `MemoryRouteRepository` + `MemoryPhotoRepository` (Memory no cascada nada por sí sola: si el helper no borra explícitamente las fotos, el test lo detecta)
  - Test: `deletePhotoFile` en navegador es no-op seguro (no lanza); en Tauri llama a `remove()` del plugin-fs (mockeado)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/shared/repositories/sqlite-route.repository.ts` (ejecutar `PRAGMA foreign_keys = ON;` en `ensureSchema()`, antes de las `CREATE TABLE`)
  - `MODIFICAR src/shared/repositories/sqlite-photo.repository.ts` (mismo pragma, por si su conexión borra fotos independientemente)
  - `MODIFICAR src/shared/services/photo-storage.service.ts` (nueva función `deletePhotoFile(filePath): Promise<void>`, usando `remove()` de `@tauri-apps/plugin-fs` en Tauri; no-op en navegador — las fotos ahí son base64 en BBDD, no hay archivo)
  - `MODIFICAR src-tauri/capabilities/default.json` (nuevo permiso `fs:allow-remove` con el mismo scope `$APPDATA/photos/**` que ya tienen `read-file`/`write-file`)
  - `CREAR src/shared/services/route-deletion.service.ts` (+spec): `deleteRouteAndPhotos(routeRepo, photoRepo, routeId)` — obtiene las fotos de la ruta, borra archivo+fila de cada una, y borra la ruta (que en SQLite ahora sí cascada puntos/paradas gracias al pragma; en Memory ya limpia sus propios mapas de puntos/paradas)
- **Notas**: El mock de `SqlDb` en `sqlite-route.repository.spec.ts`/`sqlite-photo.repository.spec.ts` es un array en JS, no SQLite real — no puede validar el pragma ni el cascade real. Este paso confía en la lectura de la documentación de `@tauri-apps/plugin-sql`/SQLite (comportamiento bien conocido: `foreign_keys` es per-conexión y está OFF por defecto) más el helper explícito como defensa en profundidad, ya que Memory nunca cascada nada por sí misma.

## Paso 1: Módulo de feedback — `toast` + `confirm-dialog`
- **Objetivo**: Mover el toast existente a `src/shared/feedback/` y crear el diálogo de confirmación bloqueante compartido.
- **AC cubiertos**: AC-001, AC-002
- **Tests a escribir** (primero):
  - `toast.spec.ts` (adaptado de su ubicación actual): sigue validando variantes success/error, autodestrucción por tiempo
  - `confirm-dialog.spec.ts`: se abre con título/mensaje/acciones dadas; pulsar una acción resuelve la promesa con su `id`; con `closable: true`, ESC y click en overlay resuelven `null`; con `closable: false`, ESC/overlay NO cierran nada; el foco se mueve al primer botón al abrir
- **Archivos a crear/modificar**:
  - `CREAR src/shared/feedback/toast.ts` (mover contenido de `shared/utils/toast.ts`), `CREAR src/shared/feedback/toast.spec.ts`
  - `ELIMINAR src/shared/utils/toast.ts` y su spec; actualizar los 2 imports (`cockpit.element.ts`, `route-detail.element.ts`)
  - `CREAR src/shared/feedback/confirm-dialog.ts` (Web Component `<confirm-dialog>`, con Shadow DOM propio vía `BaseElement`/`renderShadow` — a diferencia del toast, sí necesita estructura interactiva real y foco, así que un componente con shadow DOM encaja mejor que un div suelto en `document.body`)
  - `CREAR src/shared/feedback/confirm-dialog.spec.ts`
  - `MODIFICAR src/shared/styles/overlays.css` (quitar reglas de toast que se llevan al propio componente si se decide encapsular estilos ahí, o mantenerlas si el toast se queda como función simple — decidir en implementación; lo importante es no duplicar la hoja)
- **Notas**: `confirmDialog(opts): Promise<string | null>` es la API pública — crea el elemento, lo monta en `document.body`, lo abre, y se auto-destruye al resolver. `opts.closable` por defecto `true`; el flujo de guardar/descartar (Paso 2) lo usará con `false`. Las acciones llevan `data-cy="confirm-dialog-action-<id>"`.

## Paso 2: Guardar o descartar al parar una ruta
- **Objetivo**: El long-press de parada ya no persiste directo; abre el diálogo de decisión.
- **AC cubiertos**: AC-003, AC-004, AC-005, AC-006
- **Tests a escribir** (primero):
  - `cockpit.service.spec.ts`: nuevo método que congela el tick/GPS sin persistir ni resetear (el estado sigue reflejando los datos finales de la grabación); `confirmSaveRecording()` persiste como `completed` y resetea a `idle`; `discardRecording()` borra la ruta+fotos vía el helper del Paso 0 y resetea a `idle`
  - `cockpit.element.spec.ts`: al completar el long-press se abre el diálogo (no se persiste todavía); elegir "Guardar" persiste y muestra toast de éxito; elegir "Descartar" borra y muestra el toast correspondiente; el diálogo no es cerrable con ESC/overlay
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.service.ts`: reemplazar `stopRecordingAction` (que hacía stop+persist+reset de una vez) por tres piezas: `prepareStopAction` (stop tick/watch, sin tocar BBDD ni resetear), y separar la persistencia (ya existente en `persistRouteOnStop`) y el reset a `idle` en dos entradas del `CockpitService`: `confirmSaveRecording(): RouteMetadata` y `discardRecording(): Promise<void>`. `stopRecording()` deja de existir como acción única; `prepareStopAction` sustituye su primera mitad.
  - `MODIFICAR src/cockpit/cockpit.element.ts`: `handleStopPress` al completar el long-press llama a `prepareStop()` y abre `confirmDialog` (no cerrable) con acciones Descartar/Guardar; según la elección llama a `confirmSaveRecording()`/`discardRecording()` y muestra el toast correspondiente
- **Notas**: Congelar sin resetear implica que `getCurrentState()` siga devolviendo el estado con status `recording`/`paused` (o un nuevo status intermedio, a decidir en implementación — más simple: mantener el status tal cual y solo dejar de tickear/escuchar GPS) mientras el diálogo está abierto, para no romper la UI de fondo. `discardRecording()` necesita el `routeId` ya pre-generado (existente desde ADR-020) para borrar exactamente esa fila.

## Paso 3: Errores de foto consistentes (verificación, no reimplementación)
- **Objetivo**: Confirmar que todos los errores de foto pasan por el toast compartido; ya quedó mayormente resuelto en `mejoras-tecnicas` (pipeline unificado + `showToast` en ambos flujos).
- **AC cubiertos**: AC-007
- **Tests a escribir**: Ninguno nuevo si la verificación no encuentra gaps; si aparece algún `console.error` sin toast asociado, se cubre con el test correspondiente.
- **Archivos a crear/modificar**: Ninguno esperado; solo si la revisión encuentra un gap real.
- **Notas**: Revisar `cockpit.element.ts` (`handlePhotoCapture`) y `route-detail.element.ts` (`handleAddPhoto`) tras el import a `shared/feedback/toast.ts` del Paso 1.

## Paso 4: Confirmaciones destructivas — eliminar ruta y eliminar foto
- **Objetivo**: Añadir la acción de borrar a `<route-list>` y a la galería, ambas con `confirm-dialog`.
- **AC cubiertos**: AC-008, AC-009
- **Tests a escribir** (primero):
  - `route-list.element.spec.ts`: cada tarjeta tiene un botón de eliminar (`data-cy`); al confirmar, la ruta desaparece del listado sin recargar y aparece el toast "Ruta eliminada"; al cancelar, la ruta sigue en el listado
  - Test de galería/borrado de foto (ver Paso 6, puede resolverse junto con `<photo-gallery>` si ya existe para entonces; si no, sobre la implementación actual de `route-detail`)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-list.element.ts` (+css): botón eliminar por tarjeta, usa `confirmDialog` + `deleteRouteAndPhotos` (Paso 0) + `toast`
  - `MODIFICAR` el punto donde viva el borrado de foto (galería compartida del Paso 6, o `route-detail.element.ts` si ese paso no ha llegado aún)
- **Notas**: Tras confirmar, refrescar releyendo `repository.getAll()` (o filtrando localmente la ruta borrada, más barato) — decidir en implementación cuál es más consistente con el patrón ya usado en `rerenderPhotosSection`.

## Paso 5: Estados de carga y vacíos
- **Objetivo**: Feedback de "cargando" en operaciones asíncronas visibles; vacíos coherentes.
- **AC cubiertos**: AC-010, AC-011
- **Tests a escribir** (primero):
  - Test: `<route-list>` muestra un estado de carga mientras `fetchAndRender` está en curso (antes del primer `getAll()` resuelto)
  - Test: `<route-detail>` idem mientras carga
  - Test: durante `confirmSaveRecording`/`discardRecording`, el diálogo/botón queda en estado ocupado (evita doble click)
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-list.element.ts`, `src/routes/route-detail.element.ts` (estado `_loading` + render acorde)
  - `MODIFICAR src/shared/feedback/confirm-dialog.ts` (soporte de estado "procesando" en un botón mientras se espera su acción, si la acción es async)
- **Notas**: Reutilizar un único patrón visual de "cargando" (texto + estilo coherente con `--ink-soft`, sin inventar un spinner nuevo si un simple estado de texto/opacidad basta); mantenerlo simple.

## Paso 6: Galería y visor de fotos compartidos
- **Objetivo**: Extraer `<photo-gallery>` y `<photo-viewer>` a `shared/`, reutilizados en detalle de ruta y en grabación.
- **AC cubiertos**: AC-012, AC-013, AC-014, AC-015
- **Tests a escribir** (primero):
  - `photo-gallery.spec.ts`: renderiza miniaturas ordenadas por timestamp; placeholder cuando no hay fotos; emite evento con el índice al pulsar una miniatura
  - `photo-viewer.spec.ts`: abre en la foto indicada; navega con botones prev/next (y simula swipe); contador correcto; cierra con X, ESC y click en el fondo
  - `cockpit.element.spec.ts`: la galería del cockpit se actualiza al añadir una foto durante la grabación, sin reconstruir el resto del DOM (respeta la optimización de `structuralChange` ya existente)
  - `route-detail.element.spec.ts`: sigue pasando con la galería extraída (mismos `data-cy`)
- **Archivos a crear/modificar**:
  - `CREAR src/shared/photo-gallery/photo-gallery.element.ts` (+css, +spec)
  - `CREAR src/shared/photo-viewer/photo-viewer.element.ts` (+css, +spec)
  - `MODIFICAR src/routes/route-detail.element.ts` (adopta ambos, quita `buildPhotoGallery`/`buildPhotoThumbnail`/`openViewer` propios)
  - `MODIFICAR src/cockpit/cockpit.element.ts` (añade la galería del cockpit; necesita cargar/refrescar las fotos de `state.routeId` tras cada captura exitosa)
- **Notas**: El cockpit no tenía antes ninguna lectura de fotos (solo escritura); ahora necesita `photoRepo.getByRouteId(routeId)` tras cada `onSuccess` de captura para refrescar la galería. Cuidado con no romper el render in-place (`updateLiveValues` vs `render()` completo) — la galería se actualiza como parte de un evento discreto (nueva foto), no en cada tick de reloj.

---

## Verificación final (tras completar todos los pasos)
- `pnpm lint` → 0 warnings/errores
- `pnpm test:coverage` → 100% pass, cobertura ≥ 80%
- `pnpm build` → sin errores
- `cargo fmt`/`clippy`/`test` → limpios
- Verificación visual (Cypress + screenshot o `/run`) del flujo guardar/descartar, borrado de ruta, y galería en cockpit + detalle
- Ejecutar `review-agent` sobre `mejoras-usabilidad` (CRÍTICO obligatorio: toca `shared/`, y corrige un bug de integridad de datos preexistente — pragma de foreign keys)
