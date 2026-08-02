# Review — `auditoria-seguridad`

Verificación independiente: código releído y suite completa re-ejecutada por mí mismo (no se acepta como bueno el resumen de la implementación). Resultado íntegro al cierre: **733/733 Vitest**, `tsc --noEmit` limpio, ESLint limpio (`src/`, `cypress/`), `cargo test` 5/5, `cargo clippy -- -D warnings` limpio, `cargo fmt --check` limpio, `pnpm audit --audit-level=low` → 0 vulnerabilidades, `cargo audit --ignore RUSTSEC-2023-0071` → exit 0.

## CRÍTICO

- **Seguridad**: sin secretos ni tokens en ningún fichero tocado. CSP no se debilitó (sigue sin `unsafe-eval`/`unsafe-inline`, verificado por test). `capabilities/default.json` no se modificó — solo se le añadió un test de regresión que confirma que sigue acotado a `$APPDATA/photos/**`. **Postura de seguridad mejorada**: `pnpm audit` pasó de 10 vulnerabilidades (7 high) a 0; `cargo audit` de 1 vulnerabilidad real sin excepción a 0 con 1 excepción documentada y justificada.
- **Cambios en `src/shared/`** (radio de impacto): 3 ficheros nuevos en `src/shared/http/` (`capabilities-allowlist.spec.ts`, `pre-commit-audit-gate.spec.ts`, y `tauri-conf.spec.ts` ampliado con 2 tests más). Todos son de solo lectura de configuración/ficheros de disco, sin exports que ningún otro módulo importe — impacto real nulo sobre `cockpit`/`routes`/`profile`, que no dependen de estos ficheros.
- **Actualización de dependencias core**: `pnpm-workspace.yaml` gana 4 entradas en `overrides` — la más relevante es `vite: ^6.4.3`, que fuerza la copia de `vite`/`esbuild` que `vitepress` arrastra internamente (antes `vite@5.4.21`/`esbuild@0.21.5`) a la misma versión seguro que ya usaba el resto del proyecto. Es un override forzoso fuera del rango que `vitepress@1.6.4` declara — verificado en vivo que no rompe nada (`pnpm run docs` construye sin errores: TypeDoc + `cargo doc` + build de VitePress, los 3 pasos en verde). `postcss` sube de `8.5.16` (fijado en una sesión anterior, ya desactualizado) a `8.5.25`. `brace-expansion` gana overrides acotados por padre para sus 3 líneas major en el árbol, evitando forzar un major que su consumidor no espera.
- **Reglas del proyecto saltadas**: ninguna. Único permiso adicional pedido (instalar `cargo-audit`, herramienta de sistema fuera de `Cargo.toml`) se confirmó explícitamente con el usuario antes de instalar.

## Trazabilidad Requirement/Scenario → test

Capability `security-audit` (única de este cambio), spec en `specs/security-audit/spec.md`:

| Requirement | Scenario | Test / verificación | Estado |
|---|---|---|---|
| Auditoría bloquea el commit | Bloqueo frontend high | `.husky/pre-commit` + `src/shared/http/pre-commit-audit-gate.spec.ts` (3 tests) | ✅ automatizado |
| Auditoría bloquea el commit | Bloqueo Rust no justificado | ídem + verificación real en vivo (tarea 4.3/5.2 de `tasks.md`) | ✅ automatizado + verificación manual documentada |
| Auditoría bloquea el commit | No bloqueo frontend moderate/low | Semántica propia de `pnpm audit --audit-level=high` (comportamiento documentado de la herramienta, no código propio) | ✅ verificación por diseño de la herramienta |
| Auditoría bloquea el commit | No bloqueo Rust con excepción justificada | `cargo audit --ignore RUSTSEC-2023-0071` ejecutado en vivo, exit 0 (tarea 4.3) | ✅ verificación manual documentada |
| CSP mínima y sincronizada | CSP idénticas tauri.conf.json/index.html | `src/shared/http/tauri-conf.spec.ts` — `the CSP in index.html matches...` | ✅ automatizado |
| CSP mínima y sincronizada | Sin unsafe-eval/unsafe-inline | `tauri-conf.spec.ts` — `script-src does not allow...` | ✅ automatizado |
| Permisos Tauri allowlist | Lista no crece sin test | `src/shared/http/capabilities-allowlist.spec.ts` — `declares exactly the known set...` | ✅ automatizado |
| Comandos Rust validan inputs | `save_file`/`greet` (4 escenarios) | 4 tests ya existentes en `src-tauri/src/commands/mod.rs` (sin cambios, confirmados en verde) | ✅ automatizado |

**Cobertura de escenarios: 8/8 (100%)**, todos con verificación automatizada salvo dos que dependen de ejecutar la herramienta real (`cargo audit`/`pnpm audit`) — documentados explícitamente como tal en la propia spec, no disfrazados de automatizables.

## Hallazgos

- **[Gap, cobertura — encontrado y corregido durante esta misma revisión]**: el escenario de bloqueo frontend solo tenía verificación manual puntual (tarea 5.2), sin regresión automática — si alguien editaba `.husky/pre-commit` y perdía el `|| exit 1`, nada lo habría detectado. **Corregido**: añadido `src/shared/http/pre-commit-audit-gate.spec.ts` (3 tests, verifica presencia y orden de ambos pasos de auditoría). Outcome: **fixed**.
- **[Desviación, documentada en el propio design.md — no es un hallazgo nuevo]**: el diseño original asumía `cargo audit --deny high`, que no existe en la CLI real (`cargo audit --deny` solo acepta `warnings`/`unmaintained`/`unsound`/`yanked`). Corregido en vivo durante `apply`, con nota explícita en `design.md` Decisión 3 y en la propia spec. No queda ninguna referencia residual al comando incorrecto en el código final (`.husky/pre-commit` usa `--ignore RUSTSEC-2023-0071`, correcto).
- **[Sin hallazgos de calidad ni de convenciones de frontend]**: los 3 ficheros nuevos siguen el patrón ya establecido por `tauri-conf.spec.ts` preexistente (mismo estilo de lectura de disco, mismo `describe` por invariante), JSDoc no aplica (son `*.spec.ts`, exentos), sin CSS ni `data-cy` implicados (no hay UI en este cambio).

## Veredicto

**APPROVED**

Sin bloqueantes de seguridad, sin normas del proyecto saltadas sin justificar, 100% de escenarios con verificación (automatizada o de herramienta real documentada), y el único gap encontrado durante la propia revisión se corrigió en la misma sesión antes de este veredicto.
