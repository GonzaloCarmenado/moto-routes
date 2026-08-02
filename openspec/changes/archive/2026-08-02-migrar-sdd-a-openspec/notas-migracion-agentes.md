# Salvaguarda: reglas de los 7 subagentes → destino en `openspec/config.yaml`

Lista de trabajo de las tareas 1.1–1.3. Se conserva en el cambio como evidencia
para el gate de revisión: demuestra que ninguna regla operativa se perdió al
borrar `.claude/agents/` y `agents/`.

Fuentes: los 7 ficheros `.claude/agents/*.md` y `agents/review-agent.md`
(recuperado con `git show 801fdd2^:agents/review-agent.md`). Comparadas ambas
versiones del review-agent: la de `.claude/` es un superconjunto operativo de la
agnóstica — esta última solo añade envoltorio de rol/personalidad, ninguna regla
que no estuviera ya en la otra. Nada exclusivo se pierde.

Leyenda: **OK** = ya cubierto · **NUEVA** = huérfana, se añade · **OBSOLETA** = se descarta con motivo.

## spec-agent

| Regla | Destino | Estado |
|---|---|---|
| Leer `memory/context.md` antes de empezar | `context` | OK |
| Leer `memory/decisions.md`, no contradecir una ADR sin señalarlo | `rules.proposal` #3 | OK |
| Ante ambigüedad, preguntar al usuario — no asumir | `rules.specs` | **NUEVA** |
| Cada AC debe ser verificable por un test | `rules.specs` #2 | OK |
| Escenarios Gherkin Dado/Cuando/Entonces | `rules.specs` #1 (reformulado a WHEN/THEN) | OK |
| La spec dice QUÉ, no incluye código | `instruction` nativa del artefacto `specs` | OK |
| Cubrir edge cases y condiciones de error | `rules.specs` #4 | OK |
| No modificar specs de otros features sin petición | `CLAUDE.md` (gobernanza) | OK |
| Numerar AC secuencialmente (AC-001, AC-002…) | — | **OBSOLETA**: OpenSpec identifica por `### Requirement: <nombre>`, no por numeración correlativa |
| Mejor varias specs pequeñas que una enorme | `rules.proposal` #4 (capabilities por dominio) | OK |

## plan-agent

| Regla | Destino | Estado |
|---|---|---|
| Leer `memory/context.md` y `memory/decisions.md` | `context` + `rules.design` #1 | OK |
| Descomponer en tareas atómicas ordenadas por dependencia | `instruction` nativa del artefacto `tasks` | OK |
| Rutas de fichero concretas siguiendo la estructura por dominio | `context` | OK |
| Tests antes que implementación (TDD) | `rules.tasks` #1 | OK |
| Cada paso cabe en una sesión | `rules.tasks` #2 | OK |
| No planear sobre decisiones de arquitectura no tomadas; sugerir ADR primero | `rules.design` #1 | OK |
| No inventar AC; señalar gaps | `rules.proposal` #5 | OK |
| Estimar complejidad Small/Medium/Large | — | **OBSOLETA**: `tasks.md` es formato checkbox y no transporta la estimación; "cabe en una sesión" ya cubre el dimensionado |
| Si la spec necesita refinamiento, señalarlo pero no tocarla | — | **OBSOLETA**: separación de roles que ya no existe; el mismo agente escribe todos los artefactos |

## impl-agent

| Regla | Destino | Estado |
|---|---|---|
| TDD RED-GREEN-REFACTOR, confirmar el rojo antes de implementar | `operations.apply.guidance` #1 | OK |
| Ejecutar tests + clippy + rustfmt antes de dar un paso por completado | `operations.apply.guidance` #2 | OK |
| Seguir `specs/ui/frontend-conventions.md` | `context` | OK |
| Marcar el paso como completado | mecánica nativa de `apply` | OK |
| Código mínimo, sin sobre-ingeniería; scope creep → detenerse y preguntar | `operations.apply.guidance` | **NUEVA** |
| Tipos estrictos; Rust sin `unwrap()` injustificado | `operations.apply.guidance` | **NUEVA** |
| Ante ambigüedad, gap o contradicción: detenerse, no suponer en silencio | `operations.apply.guidance` #7 (se refuerza) | **NUEVA** (refuerzo) |
| Al acabar el plan, recomendar `review-agent` | — | **OBSOLETA**: el cierre es ahora `/opsx:archive` con su gate |

## review-agent (→ `operations.archive.guidance`)

| Regla | Destino | Estado |
|---|---|---|
| Leer la spec y el plan antes de revisar | `archive.guidance` #1–2 | OK |
| Acotar qué cambió con `git diff` / `git log` | `archive.guidance` #2 | OK |
| Por cada AC: ¿implementado? ¿dónde? ¿test que lo valida? | `archive.guidance` #3 | OK |
| Sección CRÍTICO: seguridad, `shared/`, dependencias core, normas saltadas | `archive.guidance` #4 | OK |
| Seguridad → `BLOCKED` | `archive.guidance` #5 | OK |
| Cambios en componentes compartidos → siempre CRÍTICO | `archive.guidance` #5 | OK |
| Categorías de issue restantes: gaps, desviaciones, calidad, convenciones de frontend | `archive.guidance` | **NUEVA** |
| Veredicto `CHANGES REQUESTED` (AC no implementado, AC incorrecto, norma saltada sin justificar) | `archive.guidance` | **NUEVA** — faltaba en la lista de veredictos |
| Ser objetivo y específico: nada de "se ve bien" sin fichero y línea | `archive.guidance` | **NUEVA** |
| No sugerir features nuevos (scope creep) al revisar | `archive.guidance` | **NUEVA** |

## test-agent (fusionado en el gate de revisión)

| Regla | Destino | Estado |
|---|---|---|
| Cobertura = AC cubiertos / AC totales, no % de líneas | `archive.guidance` #3 | OK |
| Cada AC con al menos un test | `archive.guidance` #3 | OK |
| Gate de cobertura de líneas ≥80% en Vitest | `operations.apply.guidance` | **NUEVA** — no estaba en ningún sitio |
| No modificar tests existentes que pasan, salvo que estén rotos | `operations.apply.guidance` | **NUEVA** |
| Si un test nuevo falla por un bug real, reportarlo y no arreglar el código | — | **OBSOLETA**: separación impl/test que desaparece al fusionar |

## init-agent

| Regla | Destino | Estado |
|---|---|---|
| Registrar cada decisión de stack como ADR en `memory/decisions.md` | `rules.design` #1 | OK |
| No instalar dependencias sin confirmarlo antes con el usuario | `operations.apply.guidance` | **NUEVA** |
| Aplicar plantillas de `agents/templates/` | — | **OBSOLETA**: las plantillas se borraron en `801fdd2` y el proyecto está inicializado |
| Preguntar por la filosofía visual antes de generar código | — | **OBSOLETA**: "Asfalto Nocturno" está definido y cerrado en `specs/ui/design-system.md` |
| No inicializar git | — | **OBSOLETA**: solo aplicaba al bootstrap |

## Resumen

- **10 reglas nuevas** añadidas a `openspec/config.yaml` en la tarea 1.3.
- **9 reglas descartadas** por obsoletas, cada una con motivo explícito arriba.
- El resto ya estaba cubierto antes de empezar.
