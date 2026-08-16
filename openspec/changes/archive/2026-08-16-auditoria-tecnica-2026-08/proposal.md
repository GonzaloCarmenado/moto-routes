## Why

Han pasado ~4 días y 5 cambios sustanciales desde la última auditoría técnica general (`limpieza-tecnica-monorepo`, 2026-08-12): `favoritos-rutas`, `compartir-ruta`, el fix de CORS+icono favorito, el icono nuevo de la app, y `sistema-logros`. Este último añadió un paquete backend entero (`internal/achievements`), una tabla y migración SQL nuevas, y 2 endpoints nuevos que nunca habían pasado por una revisión dedicada. El usuario pidió explícitamente comprobar seguridad, vulnerabilidades de dependencias, optimización y reutilización/duplicación de código antes de seguir añadiendo features.

## What Changes

Investigación real realizada (3 agentes en paralelo: seguridad, optimización, duplicación) más `pnpm audit`/`cargo audit`/`govulncheck` ejecutados de nuevo. Resultado: **sin hallazgos bloqueantes de seguridad, vulnerabilidades ni rendimiento** — todo lo nuevo cumple el mismo estándar que el resto del repo (SQL parametrizado, auth correcta en las ~20 rutas, índices ya presentes, sin dependencias nuevas, gate de tamaño de APK intacto). Las dos vulnerabilidades que reporta `cargo audit` (`RUSTSEC-2026-0235` en `rkyv`, `RUSTSEC-2023-0071` en `rsa`) ya son excepciones documentadas y activas en `.husky/pre-commit`, sin cambios desde la última vez que se investigaron.

Solo aparecieron 3 hallazgos reales, ninguno bloqueante:

- **Duplicación (frontend)**: `buildBackButton()` reimplementado casi idéntico en 3 sitios (`route-detail.element.ts`, `route-sharing.element.ts`, `achievement-list.element.ts`) — extraído a `shared/`.
- **Duplicación (backend Go)**: el trío `writeJSON`/`writeError`/`requireUserID` copiado byte a byte en 4 paquetes (`achievements`, `routesharing`, `routes`, `photos`) — extraído a un paquete interno compartido nuevo.
- **Accesibilidad (comportamiento observable)**: `achievement-unlock-overlay.element.ts` no tiene focus-trap ni cierre por ESC, a diferencia de `confirm-dialog.element.ts` (mismo patrón de overlay modal ya establecido) — se añade paridad.

**BREAKING**: ninguno. Las dos extracciones son refactors puros (mismo comportamiento observable, mismos `data-cy`); el fix de accesibilidad añade comportamiento (ESC/foco), no quita ninguno existente.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `logros`: la animación de logro desbloqueado gana manejo de teclado (ESC cierra, el foco queda atrapado dentro del overlay mientras está visible) — mismo nivel de accesibilidad que el resto de overlays modales de la app.

## Impact

- **Frontend**: `apps/mobile/src/shared/` (helper nuevo `buildBackButton`, usado desde `route-detail.element.ts`, `route-sharing.element.ts`, `achievement-list.element.ts`); `apps/mobile/src/shared/feedback/achievement-unlock-overlay.element.ts` (focus-trap + ESC, mismo patrón ya implementado en `confirm-dialog.element.ts`).
- **Backend**: paquete Go nuevo (p. ej. `apps/api/internal/apihttp/`) con `WriteJSON`/`WriteError`/`RequireUserID`; `apps/api/internal/{achievements,routesharing,routes,photos}/handler.go` pasan a importarlo en vez de redefinirlo.
- **Sin cambios** en `apps/api/internal/auth/` (su `writeError` propio no forma parte de este trío — decisión explícita, ver design.md), en el esquema de BBDD, ni en ninguna dependencia (`go.mod`, `package.json`, `Cargo.toml` no cambian).
