## Why

La ADR-027 (`memory/decisions.md`) decidió adoptar OpenSpec como framework SDD, y el tooling se instaló el 2026-08-01. Pero la migración quedó a medias y el repositorio describe hoy dos metodologías a la vez, una de las cuales ya no existe:

- `agents/` se borró en el commit `801fdd2` sin reubicar su contenido. Era la capa **agnóstica** que leían Cline+DeepSeek y Claude Code por igual — justo el criterio eliminatorio nº1 de la ADR-027. Su borrado dejó el criterio de revisión (CRÍTICO, BLOCKED, seguridad, componentes compartidos) sobreviviendo únicamente en `.claude/agents/review-agent.md`, es decir, **solo para Claude**.
- Quedan ~20 referencias muertas a `agents/` en `CLAUDE.md`, `.clinerules/00-project-rules.md` y `docs/01`, `docs/03`, `docs/05`.
- `docs/02-workflow-sdd.md` y `docs/03-agentes-skills.md` (817 líneas entre los dos, publicadas en el sitio VitePress) documentan un flujo de 6 fases y 7 agentes que ya no es el flujo del proyecto.
- Conviven dos vocabularios para lo mismo: `specs/features/<feature>.md` + `.plan.md` + `.review.md` frente a `proposal` + `specs` + `design` + `tasks`.

Un agente que entre hoy a este repositorio recibe instrucciones contradictorias sobre dónde vive una spec y qué flujo seguir. Se arregla ahora, antes de que el primer cambio de producto real se escriba bajo esa ambigüedad.

Este cambio, además, se propone a sí mismo con la herramienta a la que se migra: es la primera ejecución real de `/opsx:propose` que la ADR-027 dejó pendiente.

## What Changes

- **`openspec/config.yaml` pasa a ser el source of truth del proyecto.** Ya redactado en la sesión de exploración previa a esta propuesta (`context`, `rules` por artefacto, `operations.apply`/`archive`): absorbe stack, convenciones, diseño Asfalto Nocturno, `data-cy`, seguridad, disciplina TDD y el gate de revisión. Verificado que la CLI lo inyecta en las instrucciones de artefacto.
- **`CLAUDE.md` se reduce al mínimo** (~98 → ~30 líneas): regla fundamental reformulada en términos de OpenSpec, reglas de edición que aplican fuera del flujo de artefactos y no están cubiertas por lint, puntero a `memory/` y gobernanza de ficheros protegidos. Desaparece la tabla de 6 fases y 7 agentes.
- **`.clinerules/00-project-rules.md` se reduce en paralelo y con el mismo contenido**, para que Cline y Claude reciban exactamente lo mismo.
- **Se eliminan los 7 subagentes `.claude/agents/*.md` y los 7 comandos `.claude/commands/sdd-*.md`.** Su función queda repartida: `spec-agent`/`plan-agent` → artefactos `proposal`/`specs`/`design`/`tasks`; `impl-agent` → `operations.apply.guidance`; `review-agent` + `test-agent` → fusionados en `operations.archive.guidance`; `task-agent` → **eliminado sin sustituto** (decisión: `tasks.md` es la única trazabilidad, no se crean issues de GitHub); `init-agent` → obsoleto.
- **Documentación reescrita**: `docs/01-arquitectura-sdd.md` y `docs/02-workflow-sdd.md` pasan a describir `propose → apply → archive` con delta specs; `docs/03-agentes-skills.md` se sustituye por un documento sobre `openspec/config.yaml` como configuración única; `docs/05-memory-system.md` corrige su árbol de directorios. `docs/.vitepress/config.mjs` actualiza el sidebar.
- **`specs/features/` queda congelado**, no borrado: 52 ficheros que documentan 10 features cerradas y siguen siendo referencia útil de lo implementado. Se añade un aviso de congelación. **No se editan sus ficheros**, ni siquiera las 2 referencias históricas a `agents/review-agent.md` que contienen — congelado significa congelado.
- **No cambia comportamiento del producto**: `skip_specs: true`. Ni una línea de `src/`, `src-tauri/` o `cypress/`.

## Capabilities

Ninguna. Este cambio es de tooling y documentación: no introduce, modifica ni elimina comportamiento observable del producto, por lo que `.openspec.yaml` declara `skip_specs: true`.

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna.

## Impact

**Ficheros de metodología (se reescriben o se borran)**

| Ruta | Acción |
|---|---|
| `openspec/config.yaml` | Ya redactado (pendiente de commit) |
| `CLAUDE.md` | Reducir a ~30 líneas |
| `.clinerules/00-project-rules.md` | Reducir en paralelo |
| `.claude/agents/{spec,plan,task,impl,review,test,init}-agent.md` | Borrar (7) |
| `.claude/commands/sdd-{spec,plan,tasks,impl,review,test,init}.md` | Borrar (7) |
| `docs/01-arquitectura-sdd.md` (96 l.) | Reescribir |
| `docs/02-workflow-sdd.md` (310 l.) | Reescribir |
| `docs/03-agentes-skills.md` (507 l.) | Sustituir por doc de `config.yaml` |
| `docs/05-memory-system.md` (247 l.) | Corregir árbol y referencias a `agents/` |
| `docs/.vitepress/config.mjs` | Actualizar sidebar |
| `specs/features/` (52 ficheros) | Congelar con aviso; contenido intacto |

**Sin tocar**: `src/`, `src-tauri/`, `cypress/`, `docs/04-token-management.md`, `docs/06-seguridad.md`, `docs/07-cypress-e2e.md`, `.claude/commands/opsx/`, `.claude/skills/openspec-*`, `.cline/skills/`, `.clinerules/workflows/`, `memory/context.md` y `memory/decisions.md` (salvo la actualización de cierre).

**Riesgos operativos**

- El sitio VitePress (`pnpm run docs`) debe seguir construyendo, y el gate de cobertura de documentación al 70% (`scripts/docs-coverage.mjs`) debe seguir pasando: mide símbolos de `src/`, que no se tocan, pero el build sí puede romper por enlaces muertos en el sidebar.
- El pre-commit de Husky debe seguir en verde. Los tests E2E de Cypress están desactivados en el hook por un problema del entorno local, pero se mantienen en el proyecto; este cambio no toca UI, así que no procede ejecutarlos.
- Se pierde la revisión en contexto fresco que daba `review-agent` como subagente independiente. Mitigación: `operations.archive.guidance` exige explícitamente re-ejecutar la suite y verificar sin fiarse del resumen de implementación. Ver `design.md`.
