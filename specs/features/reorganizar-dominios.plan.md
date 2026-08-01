# Plan de Implementación: Reorganizar dominios cockpit y routes

> Origen: issue GitHub #52. Spec de refactor estructural puro (sin cambio de comportamiento observable) con organización por **vistas de la app** (no por sub-responsabilidad técnica): `cockpit/` = ventana de grabación (se mantiene plana), `routes/list/` = listado, `routes/detail/` = detalle de ruta, `components/nav-bar/` = navbar (ya correcto), `shared/` = elementos comunes (ya correcto).
>
> **Regla general de imports al mover un archivo de `src/<dominio>/` a `src/<dominio>/<subcarpeta>/`:**
> - Import same-dir `./x.js` → **no cambia** (el archivo se mueve junto a su dependencia).
> - Import `./x.js` que apunta a otro archivo que **se queda en la raíz** → `../x.js`.
> - Import `../shared/x.js` → `../../shared/x.js` (una profundidad más).
> - Import `../cockpit/x.js` o `../routes/x.js` (cross-dominio) → `../../cockpit/x.js` o `../../routes/x.js`.

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Mover `cockpit-save-route-dialog.*` a `src/cockpit/save-route-dialog/` | 3 ficheros movidos + 1 import actualizado | AC-001, AC-003 | Small |
| 2 | Reorganizar `src/routes/` en `list/` y `detail/` | 19 ficheros movidos + ~30 imports actualizados | AC-002, AC-004, AC-005 | Large |
| 3 | Actualizar imports externos (app.element.ts) y verificación final | `src/app/app.element.ts`, grep de rutas antiguas | AC-005, AC-006, AC-007, AC-008 | Medium |

---

## Paso 1: Mover `cockpit-save-route-dialog.*` a `src/cockpit/save-route-dialog/`

> **Issue GitHub**: [#61](https://github.com/GonzaloCarmenado/moto-routes/issues/61)

- **Objetivo**: El diálogo de guardado (element + css autocontenido, patrón de `shared/`) vive en `src/cockpit/save-route-dialog/`. El resto de `src/cockpit/` se mantiene plano — es UNA pantalla (ventana de grabación) y sus servicios (`native-gps`, `foreground`, `persist`, `stop`, `photo`, `long-press`) son sub-partes de la misma vista, no vistas independientes.
- **AC cubiertos**: AC-001, AC-003
- **Tests a escribir**: Ninguno nuevo — es una relocación exacta sin cambio de lógica. El spec movido es la prueba de que el comportamiento no cambió. Ejecutar `pnpm test` tras el paso → Valida AC-001 y AC-006.
- **Archivos a crear/modificar** (todos con `git mv`; los imports se actualizan tras el movimiento):
  - `git mv cockpit-save-route-dialog.element.ts save-route-dialog/cockpit-save-route-dialog.element.ts` + MODIFICAR su import `'../shared/base-element.js'` → `'../../shared/base-element.js'` (su import de `'./cockpit-save-route-dialog.element.css?inline'` no cambia — same-dir)
  - `git mv cockpit-save-route-dialog.element.css save-route-dialog/cockpit-save-route-dialog.element.css` (CSS puro)
  - `git mv cockpit-save-route-dialog.element.spec.ts save-route-dialog/cockpit-save-route-dialog.element.spec.ts` (import `./cockpit-save-route-dialog.element.js` no cambia — same-dir)
  - `MODIFICAR src/cockpit/cockpit-stop.service.ts`: su import `'./cockpit-save-route-dialog.element.js'` → `'./save-route-dialog/cockpit-save-route-dialog.element.js'`
- **Notas**: Tras el paso, ejecutar `pnpm test` y confirmar 0 tests rotos. Verificar con `grep -r "cockpit-save-route-dialog" src` que todos los imports apuntan a `./save-route-dialog/` o `../save-route-dialog/`.

## Paso 2: Reorganizar `src/routes/` en `list/` y `detail/`

> **Issue GitHub**: [#62](https://github.com/GonzaloCarmenado/moto-routes/issues/62)

- **Objetivo**: `src/routes/` queda con 2 subcarpetas por vista de aplicación: `list/` (listado de rutas) y `detail/` (detalle de ruta). No queda ningún fichero suelto en la raíz de `src/routes/`. El timeline es una pestaña del detalle, por lo que `route-timeline.transform.ts` y `route-timeline.types.ts` viven en `detail/`.
- **AC cubiertos**: AC-002, AC-004 (los imports de routes), AC-005 (profundidad hacia shared/cockpit)
- **Tests a escribir**: Ninguno nuevo — relocación exacta. Ejecutar `pnpm test` completo tras el paso → Valida AC-002 y AC-006.
- **Archivos a crear/modificar** (todos con `git mv`; los imports se actualizan tras el movimiento):

  **Subcarpeta `src/routes/detail/` (vista detalle — 14 ficheros):**
  - `git mv route-detail.element.ts detail/route-detail.element.ts` + MODIFICAR imports:
    - Todos los `'../shared/...'` → `'../../shared/...'` (21 imports: `models/route.repository`, `models/photo.repository`, `models/route.types`, `utils/format`, `utils/date`, `utils/route-naming`, `route-map/route-map.element` ×2, `route-map/route-map-photos`, `photo-capture/photo-capture.element` ×2, `photo-capture/photo-capture.types`, `services/photo-storage.service` ×2, `services/photo-capture-adapter.service`, `services/photo-delete.service`, `utils/errors`, `feedback/toast`, `base-element`, `app-events`, `photo-gallery/photo-gallery.element` ×2, `photo-viewer/photo-viewer.element`, `tab-bar/tab-bar.element`)
    - Sus imports same-dir NO cambian: `./route-detail.element.css?inline`, `./route-detail-photo.service.js`, `./route-detail.types.js`, `./route-detail-notes.js`, `./route-detail-timeline.js`, `./route-timeline.types.js` (todos se mueven juntos a `detail/`)
  - `git mv route-detail.element.css detail/route-detail.element.css` (CSS puro)
  - `git mv route-detail.types.ts detail/route-detail.types.ts` + MODIFICAR imports: `'../shared/models/photo.types.js'` → `'../../shared/models/photo.types.js'`, `'../shared/tab-bar/tab-bar.element.js'` → `'../../shared/tab-bar/tab-bar.element.js'`
  - `git mv route-detail-notes.ts detail/route-detail-notes.ts` + MODIFICAR imports: `'../shared/...'` → `'../../shared/...'` (`models/route.repository`, `models/route.types`, `feedback/toast`, `utils/errors`)
  - `git mv route-detail-photo.service.ts detail/route-detail-photo.service.ts` + MODIFICAR imports: `'../shared/...'` → `'../../shared/...'` (`models/photo.repository`, `models/photo.types`, `services/photo-capture-adapter.service` ×2, `services/photo-persist.service`)
  - `git mv route-detail-timeline.ts detail/route-detail-timeline.ts` + MODIFICAR imports:
    - `'../shared/models/route.types.js'` → `'../../shared/models/route.types.js'`
    - NO cambian: `'./route-timeline.types.js'`, `'./route-timeline.transform.js'` (se mueven juntos a `detail/`)
  - `git mv route-timeline.transform.ts detail/route-timeline.transform.ts` + MODIFICAR imports:
    - `'../shared/models/route.types.js'` → `'../../shared/models/route.types.js'`
    - `'../shared/utils/geo.js'` → `'../../shared/utils/geo.js'`
    - `'../shared/utils/format.js'` → `'../../shared/utils/format.js'`
    - `'../cockpit/cockpit.transform.js'` → `'../../cockpit/cockpit.transform.js'` (la excepción documentada AC-001; profundidad de más)
    - NO cambia: `'./route-timeline.types.js'` (same-dir)
  - `git mv route-timeline.types.ts detail/route-timeline.types.ts` (sin imports — tipos puros)
  - `git mv route-detail.element.spec.ts detail/route-detail.element.spec.ts` + MODIFICAR imports: todos los `'../shared/...'` → `'../../shared/...'` (`repositories/memory-route.repository`, `repositories/memory-photo.repository`, `models/route.repository`, `models/route.types`, `services/photo-capture-adapter.service` ×2, `route-map/route-map.element`, `route-map/route-map-photos`). Su import `'./route-detail.element.js'` no cambia — same-dir.
  - `git mv route-detail-photo.service.spec.ts detail/route-detail-photo.service.spec.ts` + MODIFICAR imports: `'../shared/models/photo.repository.js'` → `'../../shared/models/photo.repository.js'`, `'../shared/models/photo.types.js'` → `'../../shared/models/photo.types.js'`. Su import `'./route-detail-photo.service.js'` no cambia — same-dir.
  - `git mv route-detail-timeline.spec.ts detail/route-detail-timeline.spec.ts` + MODIFICAR su import `'../shared/models/route.types.js'` → `'../../shared/models/route.types.js'`. Sus imports `'./route-detail-timeline.js'` y `'./route-timeline.types.js'` no cambian — same-dir.
  - `git mv route-timeline.transform.spec.ts detail/route-timeline.transform.spec.ts` + MODIFICAR su import `'../shared/models/route.types.js'` → `'../../shared/models/route.types.js'`. Su import `'./route-timeline.transform.js'` no cambia — same-dir.

  **Subcarpeta `src/routes/list/` (vista listado — 8 ficheros):**
  - `git mv route-list.element.ts list/route-list.element.ts` + MODIFICAR imports:
    - Todos los `'../shared/...'` → `'../../shared/...'` (13 imports: `models/route.repository`, `models/photo.repository`, `models/route.types`, `utils/format`, `utils/date`, `utils/route-naming`, `base-element`, `app-events`, `services/photo-storage.service`, `services/route-deletion.service`, `feedback/confirm-dialog.element`, `feedback/toast`, `utils/errors`)
    - Sus imports same-dir NO cambian: `./route-list.element.css?inline`, `./route-list.transform.js`, `./route-list-polyline.service.js` (se mueven juntos a `list/`)
  - `git mv route-list.element.css list/route-list.element.css` (CSS puro)
  - `git mv route-list.transform.ts list/route-list.transform.ts` (sin imports — función pura verificada)
  - `git mv route-list-polyline.service.ts list/route-list-polyline.service.ts` + MODIFICAR imports: `'../shared/...'` → `'../../shared/...'` (`models/route.repository`, `models/route.types`, `services/route-polyline.service`)
  - `git mv route-list.element.spec.ts list/route-list.element.spec.ts` + MODIFICAR imports: `'../shared/repositories/memory-route.repository.js'` → `'../../shared/repositories/memory-route.repository.js'`, `'../shared/models/route.repository.js'` → `'../../shared/models/route.repository.js'`. Su import `'./route-list.element.js'` no cambia — same-dir.
  - `git mv route-list.transform.spec.ts list/route-list.transform.spec.ts` (import `./route-list.transform.js` no cambia — same-dir)
  - `git mv route-list-polyline.service.spec.ts list/route-list-polyline.service.spec.ts` + MODIFICAR imports: `'../shared/models/route.repository.js'` → `'../../shared/models/route.repository.js'`, `'../shared/models/route.types.js'` → `'../../shared/models/route.types.js'`. Su import `'./route-list-polyline.service.js'` no cambia — same-dir.

- **Notas**: Tras el paso, ejecutar `pnpm test` completo y confirmar 0 tests rotos. Verificar con `grep -r "from '\./route-" src/routes` que no queda ninguna referencia a ruta antigua en raíz. **Atención especial**: `route-detail.element.ts` es el que más imports tiene que cambiar (21 imports `../shared/` → `../../shared/`); `route-list.element.ts` tiene 13. Los imports same-dir no cambian porque los archivos se mueven juntos.

## Paso 3: Actualizar imports externos (app.element.ts) y verificación final

> **Issue GitHub**: [#63](https://github.com/GonzaloCarmenado/moto-routes/issues/63)

- **Objetivo**: Los imports externos desde `src/app/` y cualquier otro punto del proyecto apuntan a las nuevas rutas. No queda ninguna referencia a ruta antigua en todo el proyecto.
- **AC cubiertos**: AC-005 (restante), AC-006, AC-007, AC-008
- **Tests a escribir**: Ninguno nuevo — ejecutar la suite completa. La suite completa es la verificación.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/app/app.element.ts`: 2 imports de subcarpetas:
    - `'../routes/route-list.element.js'` → `'../routes/list/route-list.element.js'`
    - `'../routes/route-detail.element.js'` → `'../routes/detail/route-detail.element.js'`
    - (su import `'../cockpit/cockpit.element.js'` no cambia — `cockpit.element.ts` sigue en raíz)
- **Notas**:
  - Ejecutar la suite completa: `pnpm test` (100% pass), `pnpm lint` (0 warnings/errors), `npx tsc --noEmit` (sin errores), `pnpm exec prettier --check "src/**/*.{ts,css}"` (o el comando del proyecto).
  - Verificaciones grep finales (deben devolver 0 coincidencias de rutas antiguas):
    - `grep -r "cockpit-save-route-dialog" src --include="*.ts"` → solo rutas con `save-route-dialog/cockpit-save-route-dialog`
    - `grep -r "route-list\." src --include="*.ts"` → solo rutas con `list/route-list.`
    - `grep -r "route-detail\." src --include="*.ts"` → solo rutas con `detail/route-detail.`
    - `grep -r "route-timeline\." src --include="*.ts"` → solo rutas con `detail/route-timeline.`
  - Verificar que `src/routes/` no tiene ficheros sueltos en raíz (solo `list/` y `detail/`).
  - Ejecutar `pnpm test:coverage` para confirmar que la cobertura global no baja (refactor sin cambio de lógica).
  - Confirmar con `git status` que todos los movimientos son `renamed` (git detecta renames al ser `git mv`), lo que demuestra que el contenido no cambió salvo imports.

---

## Verificación final (todos los pasos)

- `pnpm test` (100% pass, ~527 tests) — invariante AC-006.
- `pnpm lint` (0 warnings/errors), `npx tsc --noEmit` (sin errores), `pnpm exec prettier --check` (limpio).
- `pnpm test:coverage` (≥80% líneas/ramas/funciones/statements — no debe bajar al ser refactor sin cambio de lógica).
- Greps de rutas antiguas en `src/` devuelven 0 coincidencias en imports (AC-003, AC-004).
- `src/cockpit/` tiene el diálogo en `save-route-dialog/` y el resto plano (ventana de grabación) — AC-001.
- `src/routes/` tiene exactamente 2 subcarpetas (`list/` y `detail/`) y ningún fichero suelto — AC-002.
- Atributos `data-cy` intactos en todos los `.element.ts` (no se tocó ningún selector ni atributo) — AC-007.
- Sin dependencias nuevas, sin cambios de lógica/CSS — AC-008.