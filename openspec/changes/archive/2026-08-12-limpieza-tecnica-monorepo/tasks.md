## 1. Configuración Rust/NDK (design.md D1)

- [x] 1.1 Consolidar `.cargo/config.toml`: los 4 targets (`aarch64`, `armv7`, `i686`, `x86_64`) a `android24-clang.cmd` en un único fichero, `apps/mobile/src-tauri/.cargo/config.toml`. Borrar `.cargo/config.toml` de la raíz.
- [x] 1.2 Compilar un build real (`pnpm tauri android build --target aarch64`) y confirmar que compila sin error con el linker unificado a API 24. **Compilado sin error, APK release generado.**

## 2. Higiene de git

- [x] 2.1 Eliminar el worktree obsoleto `.claude/worktrees/architecture-decisions` (`git worktree remove`), confirmar con `git worktree list` que desaparece. **Hallazgo real durante la ejecución**: no era simplemente "detrás de master" — dos commits distintos con el mismo mensaje "Merge pull request #83" (`67e1b7e` en el worktree vs `6c6b342` en master) muestran que el historial se reescribió en algún punto de la migración a OpenSpec y este worktree quedó huérfano de esa reescritura. `git worktree remove` solo desvincula el directorio de trabajo, no borra la rama `worktree-architecture-decisions` (sigue existiendo, reversible). 4.6GB de ficheros residuales (`node_modules`/`target`) no se borraron por un error de ruta larga de Windows tras el `remove` — limpiados aparte con `Remove-Item -Recurse -Force` vía PowerShell.

## 3. Componentes: borrar `counter`, mover `nav-bar` a `shared/`

- [x] 3.1 Borrar `apps/mobile/src/components/counter/` completo (`.element.ts`, `.element.css`, `.spec.ts`). Confirmado sin ningún import en `src/` antes de borrar.
- [x] 3.2 Mover `apps/mobile/src/components/nav-bar/` a `apps/mobile/src/shared/nav-bar/` (`git mv`, preserva historial).
- [x] 3.3 Actualizar el import en `apps/mobile/src/app/app.element.ts` a la nueva ruta; `tsc --noEmit` en verde. **Hallazgo real**: `nav-bar.element.ts` tenía imports relativos `../../shared/*` (correctos desde `components/nav-bar/`) que quedaron rotos un nivel de más tras el move — corregidos a `../*` (`base-element.js`, `app-events.js`, `icons/nav-icons.js`); también corregida la ruta hardcodeada en `nav-bar.element.spec.ts` (`src/components/nav-bar/...` → `src/shared/nav-bar/...`).
- [x] 3.4 Borrar `apps/mobile/src/components/` si queda vacío tras 3.1/3.2. Confirmado vacío y eliminado.

## 4. Tokens CSS: espaciado y valores sueltos

- [x] 4.1 Sustituir espaciado hardcodeado en píxeles por `var(--space-*)` en los ficheros identificados. **Grep exhaustivo hecho durante `apply`** (más completo que el informe inicial): 13 ficheros con valores de espaciado, de los cuales se convirtieron los que coinciden exactamente con un token (`--space-1`=4px … `--space-7`=48px) — `cockpit.element.css`, `cockpit-save-route-dialog.element.css`, `cockpit-stop-type-dialog.element.css`, `profile.element.css`, `route-detail.element.css`, `route-list.element.css`, `confirm-dialog.element.css`, `nav-bar.element.css`, `photo-gallery.element.css`, `photo-viewer.element.css`. Valores sin equivalente exacto en la escala (6px, 10px, 14px, 18px, 22px, -30px, etc.) se dejaron sin tocar para no introducir un cambio visual — no hay token por debajo de `--space-1` (4px) ni valores intermedios entre escalones. Anchos de borde (`border-top/bottom/left/right: Npx solid ...`) excluidos deliberadamente: no son espaciado, son grosor de línea/forma (p. ej. el triángulo de "play" en `cockpit.element.css`).
- [x] 4.2 Sustituir la sombra OKLCH hardcodeada en `profile/profile.element.css:74` por el token de color existente más cercano. **Sin token adecuado**: no existe `--success-soft`/`--success-glow` (el patrón `--amber-glow` es un blur difuso, no un anillo sólido como este) y es un único consumidor — forzar un token nuevo para un solo uso sería sobre-ingeniería. Dejado como excepción documentada con comentario explicando el porqué.
- [x] 4.3 Sustituir `font-family: monospace` por `var(--font-data)` en `routes/detail/route-detail.element.css:164` y `routes/list/route-list.element.css:138`.
- [x] 4.4 Añadir el `@import 'tokens.css'` directo en `auth/auth-forgot-password-dialog.element.css`, `auth/auth-login-dialog.element.css`, `auth/auth-register-dialog.element.css`.
- [x] 4.5 Verificación visual manual (design.md D4). **No se pudo hacer vía navegador** (extensión Claude-in-Chrome no conectada en esta sesión). Garantía equivalente: solo se sustituyeron valores que coinciden exactamente con el token (mismo px), y se confirmó sin errores tipográficos en los 7 `--space-N` usados (`grep` cruzado contra `tokens.css`) — cero diferencia visual posible por construcción. Dev server dejado corriendo en `localhost:1420` para que el usuario lo confirme si quiere.
- [x] 4.6 `pnpm run test:e2e` (Cypress) en verde tras los cambios de CSS y el move de `nav-bar`. **54/54 en verde.**

## 5. Cobertura de tests

- [x] 5.1 Añadir `apps/mobile/src/cockpit/gps/cockpit-browser-gps.service.spec.ts`. **Hallazgo real**: el fichero SÍ tenía tests, pero vivían en `cockpit.service.spec.ts` (vía el re-export en `cockpit.service.ts`) y solo cubrían `checkPermissions`/`requestPermissions` — `getCurrentPosition()`/`watchPosition()` (2 de los 4 métodos del `GpsProvider`) no tenían ningún test. Movidos los tests existentes al fichero colocado correctamente y añadidos los que faltaban; quitado el describe duplicado (y el import ya sin uso) de `cockpit.service.spec.ts`. Sin bug real encontrado.
- [x] 5.2 Añadir `apps/mobile/src/cockpit/mark-stop/cockpit-mark-stop.service.spec.ts`. **3/3 en verde**: elige categoría (registra parada + toast), cierra sin elegir (no hace nada), catálogo vacío (offline sin caché aún). Sin bug real encontrado.
- [x] 5.3 Añadir `apps/mobile/src/cockpit/persist/cockpit-persist.service.spec.ts`. **7/7 en verde**, incluye el camino de fallback a `localStorage` cuando `save()` falla (comportamiento crítico ante fallo de guardado, sin test hasta ahora). Sin bug real encontrado — el fallback ya funcionaba correctamente.
- [x] 5.4 Revisar uno a uno los 10 ficheros restantes. **8/10 con `.spec.ts` nuevo** (lógica real, sin bug encontrado en ninguno): `cloud-sync-icons.ts` (5 tests, mismo patrón que sus hermanos `action-icons`/`nav-icons`/`stop-type-icons`/`toast-icons`), `sqlite-stop-types-cache.factory.ts` (2 tests), `plugin-camera.ts` (1 test), `route-detail-states.ts` (3 tests), `route-detail-cloud-upload.ts` (4 tests), `route-detail-notes.ts` (7 tests), `route-detail-photos-panel.ts` (7 tests), `profile-vehicle-dialog-fields.ts` (19 tests). **2/10 exención justificada**: `shared/models/photo.repository.ts` (interfaz pura, sin lógica — mismo criterio ya aceptado para `shared/models/index.ts`); `app/app.element.ts` (shell raíz — su lógica propia más allá de orquestar factories ya testeadas individualmente por su cuenta es delgada, y la ejercitan los 54 tests E2E de Cypress en cada carga de página real).
- [x] 5.5 `pnpm exec vitest run --coverage` en verde, cobertura de líneas/funciones/branches/statements sin bajar del 80%. **1040/1040 tests, 96.64% líneas** (subida desde 978 antes de esta tarea, +62 tests nuevos).

## 6. Documentación y memoria

- [x] 6.1 Avisar explícitamente al usuario antes de tocar `CLAUDE.md` — **confirmado**. Añadida una frase nueva en "Reglas de edición" documentando el patrón de extracción a `.ts` suelto (design.md D5).
- [x] 6.2 Actualizar `memory/context.md` con el matiz sobre RUSTSEC-2026-0235 (`rkyv`). Añadido como continuación de la nota existente (línea 138 antes de esta sesión).
- [x] 6.3 Documentar en `memory/context.md`: estado legacy de `memory/sessions/` (design.md D2, sin borrar el fichero histórico) y qué es `moto-routes-design/` en la raíz del repo. Añadido junto al árbol de estructura del proyecto.
- [x] 6.4 Añadir una entrada de sesión en `memory/context.md` § "Estado Actual del Proyecto" resumiendo este cambio, incluyendo la decisión ya cerrada sobre el supuesto solape de capabilities (design.md D3).

## 7. Verificación en dispositivo real

- [x] 7.1 Instalar el build resultante (`bash scripts/install-android.sh`) en el dispositivo real y confirmar visualmente que `nav-bar` y las pantallas con espaciado tocado se ven igual que antes. **Confirmado por el usuario en dispositivo real** (`75fe536b`). **Gap real encontrado en el camino**: el primer intento de build falló — `cockpit-mark-stop.service.spec.ts` tenía un error de tipos (`StopCategory | undefined` no asignable a `StopCategory | null`) que `vitest run` no detectó pero `tsc` sí, porque no se había vuelto a correr `tsc --noEmit` tras añadir los últimos specs del grupo 5. Corregido (`CATEGORIES[1]!`), `tsc` limpio confirmado antes de reintentar.

## 8. Cierre

- [x] 8.1 Suite completa en verde. **Gap real encontrado y corregido**: 7 errores de ESLint en los specs nuevos del grupo 5 (tipo de aserción innecesaria, void en arrow shorthand, función vacía, async sin await) — no se habían corrido `tsc`/ESLint tras escribirlos, solo `vitest run` (que no los detecta). Corregidos todos. Final: `tsc` limpio, ESLint 0/0, Vitest 1040/1040 (96.64%), Cypress 54/54, `cargo fmt`/`clippy`/`test` en verde.
- [x] 8.2 Revisar el diff completo buscando cualquier string de secreto antes de abrir la PR. **Sin coincidencias.** También se revirtió ruido de assets compilados en `gen/android` (mismo gotcha que en `optimizar-bundle-produccion`).
