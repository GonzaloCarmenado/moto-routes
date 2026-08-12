## Why

Una auditoría técnica del monorepo (2026-08-12, a petición del usuario tras cerrar `optimizar-bundle-produccion`) encontró varios hallazgos reales de higiene: un fichero de configuración de Rust duplicado con valores contradictorios (riesgo real de build), un componente sin usar, un componente compartido mal ubicado, incumplimientos del propio sistema de tokens CSS del proyecto, huecos de cobertura de tests, y varios puntos de documentación/memoria desactualizados o sin formalizar. Ninguno es urgente por sí solo, pero conviene agruparlos en un único cambio de mantenimiento antes de que se acumulen más — igual que ya se hizo con el hallazgo de `ci.yml` en `optimizar-bundle-produccion`.

## What Changes

- Elimina la duplicación de `.cargo/config.toml` (raíz vs `apps/mobile/src-tauri/`) con NDK API levels distintos (24 vs 34) — riesgo real de que Cargo resuelva el fichero equivocado según desde dónde se invoque.
- Elimina el worktree git obsoleto `.claude/worktrees/architecture-decisions` (ya mergeado, 217 commits detrás de `master`).
- Borra el componente `counter` sin usar, leftover de la plantilla de Vite/Tauri (`apps/mobile/src/components/counter/`).
- Mueve `nav-bar` (componente compartido real) de `apps/mobile/src/components/` a `apps/mobile/src/shared/nav-bar/`, alineado con el patrón de organización por dominio del proyecto.
- Sustituye espaciado hardcodeado en píxeles por los tokens `--space-*` ya existentes, en 11 ficheros `*.element.css`.
- Sustituye una sombra OKLCH hardcodeada y dos `font-family: monospace` hardcodeados por sus tokens correspondientes.
- Añade `.spec.ts` a los 3 servicios no triviales sin test (`cockpit-browser-gps.service.ts`, `cockpit-mark-stop.service.ts`, `cockpit-persist.service.ts`); evalúa caso a caso los otros 10 ficheros sin `.spec.ts` de menor riesgo.
- Añade el `@import 'tokens.css'` directo que falta en 3 diálogos de `auth/` (hoy llega solo de forma transitiva).
- Documenta en `CLAUDE.md` el patrón ya real de extraer lógica a un `.ts` suelto cuando un `.element.ts` supera el límite de líneas (**requiere avisar al usuario antes de tocar `CLAUDE.md`, regla del propio proyecto**).
- Actualiza `memory/context.md` con el matiz ya investigado sobre RUSTSEC-2026-0235 (`rkyv`): transitivo, feature no activada, baja urgencia real.
- Decide y documenta el futuro de `memory/sessions/` (prácticamente sin usar desde que `context.md` lleva el resumen inline).
- Documenta en `memory/context.md` qué es `moto-routes-design/` (carpeta de referencia de diseño en la raíz, sin explicar hoy).
- Cierra la duda sobre posible solape de capabilities en `openspec/specs/` (`api-security` vs `security-audit`, `stop-types-catalog` vs `route-stop-types-display`) — **ya investigado durante `propose`: sin solape real**, `api-security` es la postura de seguridad de `apps/api` (backend) y `security-audit` la de `apps/mobile`/Tauri (frontend); `stop-types-catalog` es el catálogo de datos y `route-stop-types-display` es la visualización en el detalle de una ruta. Se documenta en `design.md` para cerrar la duda, sin acción de consolidación.

**Sin comportamiento observable nuevo en ninguna capability existente**: todo el alcance es reorganización de ficheros, sustitución de valores hardcodeados por tokens (mismo resultado visual), cobertura de tests añadida sobre comportamiento ya existente, y documentación — `skip_specs: true` en `.openspec.yaml` de este cambio.

## Capabilities

Sin capabilities nuevas ni modificadas (`skip_specs: true` — ver Why/What Changes).

## Impact

- `apps/mobile/src-tauri/.cargo/config.toml` y `.cargo/config.toml` (raíz).
- `.claude/worktrees/architecture-decisions` (eliminado vía `git worktree remove`, fuera del árbol de trabajo normal).
- `apps/mobile/src/components/counter/` (eliminado).
- `apps/mobile/src/components/nav-bar/` → `apps/mobile/src/shared/nav-bar/` (movido, imports actualizados en `apps/mobile/src/app/app.element.ts` y cualquier otro consumidor).
- 11 ficheros `*.element.css` con espaciado a token (lista completa en `design.md`/`tasks.md`).
- `apps/mobile/src/profile/profile.element.css`, `apps/mobile/src/routes/detail/route-detail.element.css`, `apps/mobile/src/routes/list/route-list.element.css` (valores sueltos).
- 3 ficheros `.spec.ts` nuevos en `apps/mobile/src/cockpit/{gps,mark-stop,persist}/`.
- `apps/mobile/src/auth/auth-{forgot-password,login,register}-dialog.element.css`.
- `CLAUDE.md` (con aviso previo).
- `memory/context.md`.
- Sin cambios en `apps/api`, sin cambios de comportamiento en ninguna pantalla ni flujo de la app.
