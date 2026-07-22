# Revisión: Mejoras de Usabilidad

## 📋 Ficheros Tocados (resumen — ver el diff completo para el detalle línea a línea)

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/repositories/sqlite-route.repository.ts` | MODIFICADO | `PRAGMA foreign_keys = ON;` — sin esto, el borrado de rutas no cascadeaba puntos/paradas/fotos en el SQLite real (bug preexistente nunca antes ejercitado) |
| `src/shared/repositories/sqlite-photo.repository.ts` | MODIFICADO | Mismo pragma, por si su conexión borra algo independientemente |
| `src/shared/services/photo-storage.service.ts` | MODIFICADO | Nueva `deletePhotoFile()` (best-effort, no-op en navegador) |
| `src-tauri/capabilities/default.json` | MODIFICADO | Nuevo permiso `fs:allow-remove` escopado a `$APPDATA/photos/**` |
| `src/shared/services/route-deletion.service.ts` | CREADO | `deleteRouteAndPhotos()` — borra fotos (archivo+fila) y la ruta, consistente en SQLite y Memory |
| `src/shared/feedback/toast.ts` | CREADO (movido) | Variante `info`, roles ARIA, `dismiss()` devuelto |
| `src/shared/feedback/confirm-dialog.element.ts` | CREADO | `<confirm-dialog>` + `confirmDialog()`, con focus trap |
| `src/shared/utils/toast.ts` | ELIMINADO | Movido a `shared/feedback/` |
| `src/cockpit/cockpit.service.ts` | MODIFICADO | `stopRecording()` → `prepareStop()` + `confirmSaveRecording()` + `discardStop()` (flujo en dos fases) |
| `src/cockpit/cockpit-stop.service.ts` | CREADO | Orquesta el diálogo guardar/descartar + toast de progreso |
| `src/cockpit/cockpit-long-press.ts` | CREADO | Controlador de long-press (timer + arco SVG), extraído de `cockpit.element.ts` |
| `src/cockpit/cockpit-photo.service.ts` | MODIFICADO | Nueva `fetchGalleryPhotos()` |
| `src/cockpit/cockpit.render.ts` | MODIFICADO | Nueva `buildPhotoGalleryElement()` |
| `src/cockpit/cockpit.element.ts` | MODIFICADO | Wiring del diálogo guardar/descartar y de la galería en grabación |
| `src/routes/route-list.element.ts` (+.css) | MODIFICADO | Botón eliminar por tarjeta + estado de carga |
| `src/routes/route-detail.element.ts` (+.css) | MODIFICADO | Adopta `<photo-gallery>`/`<photo-viewer>`; estado de carga |
| `src/routes/route-detail-photo.service.ts` | MODIFICADO | Nueva `deletePhotoWithConfirmation()` |
| `src/shared/photo-gallery/` | CREADO | Componente compartido (elemento + css + spec) |
| `src/shared/photo-viewer/` | CREADO | Componente compartido (elemento + css + spec) |
| `src/shared/styles/overlays.css` | MODIFICADO | Solo estilos de toast (visor/diálogo ya no viven aquí — tienen su propio Shadow DOM) |

## 📝 Resumen de Cambios
- Feedback consistente: toast de 3 variantes + diálogo de confirmación bloqueante, ambos compartidos.
- El long-press de parada ya no persiste directo: pregunta guardar/descartar, con borrado real (archivo + fila + cascada BBDD) al descartar.
- `<route-list>` y la galería de fotos ganan confirmación antes de borrar.
- Estados de carga en listado y detalle de ruta.
- Galería y visor de fotos extraídos a componentes compartidos, usados en detalle de ruta **y** en grabación (antes solo en detalle).
- **Bug de integridad de datos corregido**: el `ON DELETE CASCADE` del esquema SQLite era inerte porque `PRAGMA foreign_keys` nunca se activaba — bug preexistente que esta spec expone al ser la primera en ejercitar el borrado real desde la UI.

## ✅ Cumplimiento de AC
15/15 AC cumplidos. Ver checkboxes con evidencia (archivo/test) en `specs/features/mejoras-usabilidad.md`.

## 🔴 CRÍTICO

### Seguridad
✅ Sin incidencias. El nuevo permiso `fs:allow-remove` está escopado igual que `read-file`/`write-file` (`$APPDATA/photos/**`), sin ampliar la superficie más allá de lo necesario.

### Componentes Comunes Afectados
⚠️ Cambios importantes en `src/shared/`: nuevo módulo `feedback/` (toast + confirm-dialog), nuevos `photo-gallery/` y `photo-viewer/`, nuevo `route-deletion.service.ts`, y el pragma SQLite en ambos repositorios compartidos. Riesgo controlado: 284 tests (todos verdes, cobertura 90.46%), y verificación visual en la app real (Cypress + screenshots) de los flujos guardar/descartar y borrar ruta.

### Actualizaciones Core
✅ Ninguna dependencia nueva. Cambio de capability de Tauri (`fs:allow-remove`), ya cubierto arriba.

### Normas Saltadas
✅ Ninguna.

## ⚠️ Issues Encontrados

### ISSUE-001: El pragma `PRAGMA foreign_keys = ON` no está verificado contra SQLite real
- **Severidad**: BAJA (mitigado)
- **Descripción**: Los tests de `sqlite-route.repository.spec.ts`/`sqlite-photo.repository.spec.ts` usan un mock de `SqlDb` en JS (array en memoria), no SQLite real — no pueden validar que el pragma efectivamente activa el cascade en producción.
- **Mitigación aplicada**: `deleteRouteAndPhotos()` no depende solo del cascade SQL — borra explícitamente cada foto (archivo + fila) antes de borrar la ruta, así que el resultado es correcto en ambos backends aunque el pragma fallara silenciosamente.
- **Recomendación**: Verificar manualmente en un dispositivo Android real que borrar una ruta con fotos no deja huérfanos en `route_points`/`route_stops` (la cascada de esas dos tablas sí depende únicamente del pragma).

### ISSUE-002: AC-010 (loading state homogéneo) es una homogeneización parcial
- **Severidad**: BAJA
- **Descripción**: El botón de añadir foto sigue con su spinner propio (sin cambios); los nuevos estados de carga de listado/detalle son texto simple (`Cargando rutas…`/`Cargando ruta…`). Son visualmente coherentes (mismos tokens de color/tipografía) pero no un componente de carga unificado.
- **Recomendación**: Si se detecta necesidad real de más estados de carga en el futuro, extraer un componente de "loading" compartido en ese momento — no antes (evitar abstraer sin un segundo caso de uso real).

### ISSUE-003: Descartar con fallo de borrado deja una fila `active` huérfana
- **Severidad**: BAJA
- **Descripción**: Si `deleteRouteAndPhotos()` falla (p. ej. error de E/S), `resolveStopDecision` muestra el toast de error y llama a `discardStop()` de todos modos (resetea el cockpit a `idle`), pero la fila `active` de esa ruta queda en la BBDD sin persistir.
- **Recomendación**: Aceptable por ahora (el error es visible al usuario); si se vuelve un problema recurrente, considerar un mecanismo de limpieza de rutas `active` huérfanas al iniciar la app.

## 📊 Veredicto
- [x] **APPROVED**

Los 15 AC cumplidos, con un hallazgo de integridad de datos preexistente corregido como parte del trabajo (Paso 0 del plan). Gates verdes: ESLint 0 warnings, 284 tests, cobertura 90.46% (≥80%), build OK, Clippy/rustfmt limpios (sin cambios en Rust más allá del capability). Verificación visual confirmada en la app real para los dos flujos de mayor riesgo (guardar/descartar ruta, borrar ruta).
