# CLAUDE.md — Moto Routes

Este proyecto sigue **Spec-Driven Development (SDD)**. Este archivo es el equivalente, para Claude Code, de `.clinerules` (que sigue vigente para quien trabaje con Cline + DeepSeek). Ambos flujos comparten el mismo source of truth: `specs/`, `agents/` (definiciones agnósticas) y `memory/` (estado persistente del proyecto). No son metodologías distintas — es el mismo SDD servido a dos herramientas distintas.

Documentación completa en `docs/01-arquitectura-sdd.md` … `docs/07-cypress-e2e.md`. Léela cuando necesites el detalle; este archivo es el resumen operativo que se carga siempre.

## Regla fundamental

No se escribe código sin una spec previa en `specs/features/`. Si el código y la spec divergen, se arregla el código o se actualiza la spec — nunca quedan desalineados.

## Memoria del proyecto (leer al empezar a trabajar aquí)

`memory/` es memoria **del proyecto**, no la memoria personal de Claude (esa vive fuera del repo). Nadie te la carga automáticamente — léela tú mismo al empezar una tarea sobre este repo:

- `memory/context.md` — stack, estructura, estado actual, próximo hito. Cárgalo siempre antes de tocar código.
- `memory/decisions.md` — ADRs (decisiones de arquitectura con contexto, alternativas, consecuencias). Consúltalo antes de revertir o cuestionar una decisión ya tomada; si vas a tomar una decisión de arquitectura nueva, añade un ADR aquí.
- `memory/tokens.md` — registro histórico de consumo/sesiones. Con Claude Code el contexto se compacta automáticamente, así que esto ya no es una necesidad operativa como con DeepSeek (ventana 128K) — pero sigue siendo útil como bitácora de qué se hizo en cada sesión larga. Actualízalo si la sesión fue significativa.
- `memory/sessions/` — resúmenes de sesiones largas o con aprendizajes no obvios.

Actualiza `memory/context.md` (estado actual) y, si aplica, `memory/decisions.md` (nuevo ADR) al completar un hito — no esperes a que te lo pidan.

## Workflow SDD → Subagentes y comandos Claude

Cada fase de `docs/02-workflow-sdd.md` tiene un subagente nativo en `.claude/agents/` (equivalente a `@agent:nombre` en Cline) y un slash command en `.claude/commands/` para invocarlo rápido:

| Fase | Subagente (Agent tool) | Comando | Input | Output |
|------|------------------------|---------|-------|--------|
| Spec | `spec-agent` | `/sdd-spec` | Requisito en lenguaje natural | `specs/features/<feature>.md` |
| Plan | `plan-agent` | `/sdd-plan` | Spec | `specs/features/<feature>.plan.md` |
| Tasks | `task-agent` | `/sdd-tasks` | Plan | GitHub Issues (`gh`) |
| Implement | `impl-agent` | `/sdd-impl` | Plan + Spec | `src/` + tests (TDD) |
| Review | `review-agent` | `/sdd-review` | Spec + código + tests | `specs/features/<feature>.review.md` |
| Test | `test-agent` | `/sdd-test` | Spec + tests | Reporte cobertura + tests |
| Init (solo setup nuevo) | `init-agent` | `/sdd-init` | Plantilla (`agents/templates/`) | Scaffolding del stack |

Un feature no se considera terminado hasta que `review-agent` devuelve `APPROVED` o `APPROVED WITH MINOR ISSUES`. Un `BLOCKED` (seguridad o componente compartido crítico) detiene el trabajo hasta resolverlo.

Regla de oro del ciclo: si `review-agent` o `test-agent` encuentran un gap, o se corrige el código o se actualiza la spec — nunca se ignora.

## Stack (resumen — detalle completo en memory/context.md)

TypeScript 5.7 strict + Vite 6 + Web Components nativos (frontend), Rust + Tauri 2 (backend/mobile), Vitest (80% coverage) + cargo test, ESLint 9 strict + Clippy deny-warnings, Husky pre-commit, pnpm + Cargo, SQLite vía `@tauri-apps/plugin-sql`.

## Quality Gates

- Test pass rate: 100% (frontend + backend)
- Code coverage (TS): 80% (lines/functions/branches/statements)
- AC coverage: 100% (cada criterio de aceptación tiene al menos un test)
- ESLint 0 warnings/errors · Clippy deny warnings · rustfmt aplicado · cargo audit sin vulnerabilidades
- Build: `tsc` + `cargo build` + `vite build` + `tauri build` sin errores

## Convenciones de Frontend

- Estructura por dominio funcional (`cockpit/`, `routes/`, `photos/`...), no por tipo técnico.
- Separación estricta: `.element.ts` + `.element.css` + `.service.ts` + `.transform.ts` + `.types.ts`.
- Prohibido CSS inline salvo animación/posicionamiento dinámico justificado.
- Componentes compartidos van en `src/shared/`, nunca duplicados entre dominios — si dudas si algo es shared, pregunta antes de crear un componente nuevo.
- Detalle completo: `specs/ui/frontend-conventions.md`.

## Diseño Visual — "Asfalto Nocturno"

- Source of truth: `specs/ui/design-system.md` y `src/shared/styles/tokens.css`.
- Tokens activos: `--bg-top`, `--panel`, `--amber`, `--ink`, `--font-display/ui/data`. Nunca hardcodear color/fuente/espaciado/sombra/radio; nunca usar `--color-*`/`--glow-*`/`--neon-*` (eliminados, ver ADR-019).
- Modo oscuro obligatorio (uso en manillar de moto, sin variante clara). Hitbox mínima 56×56px (uso con guantes). Contraste WCAG AA mínimo, respeta `prefers-reduced-motion`.
- Un Shadow DOM no hereda `index.css` — los estilos reales de un componente vienen de su propio `*.element.css` importando `tokens.css`.

## Tests E2E (Cypress)

- Todo elemento interactivo lleva `data-cy="<contexto>-<tipo>-<accion>"` único. Nunca selectores de clase/ID/posición DOM.
- Tests autocontenidos y paralelizables: cada `describe` crea y limpia sus propios datos.
- Validar TODOS los campos de un formulario, no solo los obligatorios. No validar IDs autogenerados.
- Detalle completo y ejemplos: `docs/07-cypress-e2e.md`.

## Seguridad

- Nunca secretos/tokens/contraseñas/connection strings en código — van a variables de entorno o GitHub Secrets. Solo claves públicas (ej. anon key) pueden vivir en código.
- CSP estricta: sin `unsafe-eval` ni `unsafe-inline` en producción (Tauri: `index.html` + `tauri.conf.json` → `app.security.csp`).
- Pre-commit audita dependencias: bloquea en critical/high (`npm audit --audit-level=high`, `cargo audit --deny high`), warning en moderate.
- Validación de inputs en frontend y backend (defensa en profundidad). Dependencias mínimas — preferir APIs nativas.
- Detalle completo: `docs/06-seguridad.md`.

## Archivos y acciones que requieren autorización explícita

- No modificar `specs/` sin que el usuario lo pida explícitamente.
- No modificar este `CLAUDE.md`, `.clinerules`, ni `.claude/agents/` o `.claude/commands/` sin avisar primero — son la definición del propio workflow.
- No commitear archivos generados/temporales, ni `.env` con valores reales.

## Idioma

- Documentación y specs en español. Código en inglés (variables, funciones, comentarios).
- Commits en español o inglés, pero consistentes dentro del mismo PR.

## Build Android — ver memory/context.md

Hay una lección aprendida detallada (workarounds de Windows, comando exacto `pnpm tauri android build --target aarch64 --debug`) en `memory/context.md` bajo "Build Android". No la repitas de memoria: léela antes de tocar el build de Android, puede haber cambiado.
