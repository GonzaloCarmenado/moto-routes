## Why

`docs/06-seguridad.md` exige desde hace tiempo que el pre-commit bloquee en vulnerabilidades `high`/`critical` (`npm audit --audit-level=high`, `cargo audit --deny high`), pero `.husky/pre-commit` no ejecuta ninguno de los dos comandos — nunca se ha comprobado en la práctica si el árbol de dependencias tiene vulnerabilidades conocidas. Confirmado en esta sesión: `pnpm audit --audit-level=low` reporta **10 vulnerabilidades sin resolver (7 high, 3 moderate)**, y `cargo audit` **ni siquiera está instalado** en la máquina de desarrollo. Además, la CSP (`tauri.conf.json` + `index.html`) y `capabilities/default.json` no se han re-verificado desde ADR-014 pese a varias features nuevas (perfil, fotos, GPS nativo) que han tocado permisos y APIs externas. Este cambio reafirma ADR-014 (Seguridad en Tauri — CSP + permisos mínimos + path validation) cerrando la brecha entre lo documentado y lo implementado.

## What Changes

- Instalar `cargo-audit` (confirmado con el usuario antes de instalar nada) y ejecutar la auditoría real de `Cargo.lock`; resolver o justificar cada hallazgo.
- Resolver o justificar documentadamente las 10 vulnerabilidades actuales de `pnpm audit` (actualizar versiones donde sea seguro sin romper build; si alguna no tiene fix disponible, documentar el riesgo aceptado y por qué).
- Añadir el gate de auditoría real a `.husky/pre-commit`: bloquear en `high`/`critical` (frontend y Rust), tal y como ya exige `docs/06-seguridad.md` pero nunca se implementó.
- Re-verificar CSP (`tauri.conf.json` → `app.security.csp` e `index.html`, deben seguir sincronizados) y `capabilities/default.json` contra el principio de permisos mínimos de ADR-014; documentar el resultado.
- Revisar la validación de inputs en los comandos Rust expuestos a IPC (`src-tauri/src/commands/mod.rs`) — path traversal, inputs vacíos — y confirmar que el frontend valida en el límite del sistema (formularios) antes de invocar esos comandos.
- Revisar permisos declarados en `AndroidManifest.xml` frente a los realmente usados en runtime (ya hubo un incidente real esta sesión con permisos de ubicación revocados — ver `memory/` — que es justo el tipo de desajuste que este audit debe detectar de forma sistemática, no solo reactiva).

**Fuera de alcance** (confirmado con el usuario): tests E2E de Cypress — se comprobó que los 39 specs pasan en local y no hay CI de E2E; el problema que se recordaba ya no existe.

## Capabilities

### New Capabilities
- `security-audit`: gate de auditoría de dependencias (npm + cargo) en pre-commit con umbral de bloqueo en high/critical, y verificación documentada de CSP/capabilities/validación de inputs contra ADR-014.

### Modified Capabilities
(ninguna — no hay specs previas de seguridad en `openspec/specs/`; `docs/06-seguridad.md` es documentación de política, no una spec OpenSpec)

## Impact

- `.husky/pre-commit` — nuevo paso de auditoría (frontend + Rust).
- `package.json` — posibles bumps de versión en devDependencies vulnerables (`vitepress`, `typedoc`, `vite`, `postcss`, `brace-expansion` o sus padres) y/o entrada en `pnpm-workspace.yaml` → `overrides` si el fix solo existe como paquete transitivo (mismo patrón ya usado con `postcss: 8.5.16`, ver `memory/context.md`).
- `src-tauri/Cargo.toml` / `Cargo.lock` — posibles bumps si `cargo audit` encuentra algo explotable.
- `src-tauri/tauri.conf.json`, `index.html`, `src-tauri/capabilities/default.json` — sin cambios esperados si la revisión confirma que siguen mínimos; cambios solo si se detecta una brecha real.
- `src-tauri/src/commands/mod.rs` — posible endurecimiento de validación si la revisión encuentra un gap.
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml` — solo lectura/comparación, sin cambio esperado salvo hallazgo real.
- Herramienta nueva en el entorno de desarrollo: `cargo-audit` (binario de sistema, no dependencia del proyecto).
