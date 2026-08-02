## 1. Salvaguarda antes de borrar

- [x] 1.1 Extraer las reglas operativas de los 7 ficheros `.claude/agents/*.md` y de `agents/review-agent.md` (recuperable con `git show 801fdd2^:agents/review-agent.md`) a una lista de trabajo temporal, una línea por regla.
- [x] 1.2 Confirmar, regla a regla, que cada una tiene destino en `openspec/config.yaml` (`context`, `rules.<artefacto>` o `operations.{apply,archive}.guidance`). Marcar las huérfanas.
- [x] 1.3 Añadir a `openspec/config.yaml` las reglas huérfanas que sigan siendo válidas. Descartar explícitamente, dejando constancia en la lista, las que ya no apliquen (todo lo referido a `agents/templates/`, a issues de GitHub y al formato `<feature>.md`/`.plan.md`/`.review.md`).
- [x] 1.4 Verificar que `openspec/config.yaml` sigue parseando y que la CLI lo inyecta: `openspec instructions proposal --change migrar-sdd-a-openspec --json` debe devolver `context` y `rules` no vacíos.

## 2. Ficheros de instrucciones siempre cargados

- [x] 2.1 Reescribir `CLAUDE.md` (~30 líneas): regla fundamental en términos de OpenSpec (no se escribe código sin un change), reglas de edición que aplican fuera del flujo de artefactos y no cubre ESLint (`data-cy`, tokens, no CSS inline, `shared/`), puntero a `memory/` y a `openspec/config.yaml`, gobernanza de ficheros protegidos e idioma. Sin tabla de fases ni mención a agentes.
- [x] 2.2 Reescribir `.clinerules/00-project-rules.md` con **el mismo contenido** que `CLAUDE.md`, adaptando solo las referencias propias de Cline (`.clinerules/workflows/opsx-*`).
- [x] 2.3 Comprobar que ninguno de los dos ficheros menciona `agents/`, `spec-agent`, `plan-agent`, `task-agent`, `impl-agent`, `review-agent`, `test-agent`, `init-agent` ni `specs/features/` como destino de escritura.

## 3. Eliminación del tooling del SDD propio

- [x] 3.1 Borrar los 7 ficheros de `.claude/agents/` (`spec`, `plan`, `task`, `impl`, `review`, `test`, `init`).
- [x] 3.2 Borrar los 7 comandos `.claude/commands/sdd-*.md`.
- [x] 3.3 Verificar que `.claude/commands/opsx/`, `.claude/skills/openspec-*`, `.cline/skills/` y `.clinerules/workflows/` quedan intactos.

## 4. Documentación

- [x] 4.1 Reescribir `docs/01-arquitectura-sdd.md`: arquitectura con `openspec/{specs,changes}`, `config.yaml` como configuración única, `memory/` como memoria de proyecto y `specs/features/` como histórico congelado. Corregir el árbol de directorios que aún muestra `agents/`.
- [x] 4.2 Reescribir `docs/02-workflow-sdd.md`: ciclo `propose → apply → archive` con delta specs, en lugar de las 6 fases con agentes.
- [x] 4.3 Sustituir `docs/03-agentes-skills.md` por un documento sobre `openspec/config.yaml` (`context`, `rules` por artefacto, `operations.apply`/`archive`), incluyendo dónde aterrizó cada uno de los 7 agentes antiguos.
- [x] 4.4 Corregir en `docs/05-memory-system.md` el árbol de directorios y las 2 referencias a `agents/`.
- [x] 4.5 Actualizar el sidebar y la navegación de `docs/.vitepress/config.mjs` con los títulos nuevos.
- [x] 4.6 Revisar `docs/index.md`, `docs/04-token-management.md`, `docs/06-seguridad.md` y `docs/07-cypress-e2e.md` en busca de referencias al flujo antiguo; corregir solo lo que haya quedado desalineado.

## 5. Congelación del histórico

- [x] 5.1 Crear `specs/README.md` explicando que `specs/features/` es histórico congelado del SDD anterior, que se consulta pero no se amplía, y que todo cambio nuevo pasa por `openspec/changes/`. Enlazar ADR-027.
- [x] 5.2 Confirmar que **no se ha editado ningún fichero de `specs/features/`**, incluidas las 2 referencias históricas a `agents/review-agent.md` en `mejoras-tecnicas.md` y `deuda-tecnica-auditoria.md`.

## 6. Verificación

- [x] 6.1 Comprobar que no queda ninguna referencia muerta fuera del histórico congelado: `grep -rn "agents/" --include="*.md" CLAUDE.md .clinerules/ docs/` sin resultados.
- [x] 6.2 Ejecutar `pnpm run docs` y confirmar que el sitio VitePress construye sin errores y que el gate de cobertura de documentación al 70% (`scripts/docs-coverage.mjs`) sigue pasando.
- [x] 6.3 Ejecutar la suite del pre-commit: `pnpm test`, `tsc --noEmit`, ESLint sin warnings, y en `src-tauri/` `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check`. Deben seguir en el mismo estado que antes del cambio, sin regresiones. No procede ejecutar Cypress: este cambio no toca UI.
- [x] 6.4 Confirmar con `git status` que no se ha modificado ningún fichero de `src/`, `src-tauri/` ni `cypress/`.
- [x] 6.5 Ejecutar `openspec validate --all` y `openspec doctor` sin errores.

## 7. Cierre

- [x] 7.1 Añadir a `memory/decisions.md` la nota de actualización de ADR-027 explicando la desviación: los 7 agentes se eliminan en vez de realinearse, con el racional y la vuelta atrás definida en `design.md` (Decisión 2).
- [x] 7.2 Actualizar `memory/context.md` con el estado resultante: migración completada, `openspec/config.yaml` como source of truth, `specs/features/` congelado, y `tasks.md` como única trazabilidad de progreso (sin issues de GitHub).
- [x] 7.3 Pasar el gate de revisión de `operations.archive.guidance` y escribir el veredicto en `openspec/changes/migrar-sdd-a-openspec/review.md` antes de archivar.
