## Context

Ver `proposal.md` — Why para la motivación. Lo que condiciona el enfoque técnico es la superficie real de extensión que ofrece la CLI de OpenSpec v1.7.0, verificada en este repositorio:

```
openspec/config.yaml
├── context:                  → inyectado al escribir CUALQUIER artefacto
├── rules:                    → keyed por artifact id (proposal/specs/design/tasks)
└── operations:
      apply.guidance:         → cómo se implementa
      archive.guidance:       → cómo se cierra

openspec schema fork spec-driven → permite añadir/editar artefactos del schema
```

Cuatro artefactos de fábrica y dos operaciones. Ese es todo el tablero donde reubicar el SDD propio. Verificado con `openspec instructions <artifact> --change ... --json`: el `context` (3.036 caracteres) y las `rules` del artefacto llegan efectivamente al agente que escribe.

Dos restricciones más marcan el diseño:

1. **Momento de inyección.** `config.yaml` se inyecta al escribir un artefacto o al ejecutar `apply`/`archive`. `CLAUDE.md` y `.clinerules/` se cargan siempre, en cada turno. Son mecanismos con alcance distinto, no intercambiables.
2. **Ningún mecanismo de OpenSpec bloquea nada.** `rules` y `guidance` son instrucciones para el agente, no gates ejecutables. El único gate con dientes reales del proyecto sigue siendo el pre-commit de Husky, que es agnóstico y OpenSpec no toca.

ADR-027 en `memory/decisions.md` es la decisión marco. Este diseño ejecuta sus consecuencias con dos desviaciones respecto a lo que aquella ADR anticipó, ambas registradas abajo.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad de metodología, agnóstica de herramienta, que Cline+DeepSeek y Claude Code consuman por el mismo camino.
- Cero referencias muertas: ningún fichero de instrucciones apunta a algo que no existe.
- Los gates de calidad propios (TDD estricto, revisión con sección CRÍTICO y veredicto, cobertura de escenarios) sobreviven a la migración, reubicados — no se pierden ni se diluyen.
- `CLAUDE.md` y `.clinerules/00-project-rules.md` reducidos a lo que `config.yaml` estructuralmente no puede cubrir.

**Non-Goals:**

- Migrar las 10 features cerradas de `specs/features/` al formato de delta specs. La guía oficial de adopción brownfield de OpenSpec lo desaconseja explícitamente y la ratificación de ADR-027 ya lo descartó.
- Forkear el schema `spec-driven` para añadir un artefacto de revisión. Ver Decisions.
- Recuperar `agents/` en cualquier forma.
- Tocar `src/`, `src-tauri/` o `cypress/`. Cualquier cambio de comportamiento que aparezca durante la implementación queda fuera de este cambio.
- Reactivar los tests E2E en el pre-commit de Husky. Están desactivados a propósito por un problema del entorno local del usuario y se mantienen así.

## Decisions

### 1. `config.yaml` como source of truth, con residuo consciente en `CLAUDE.md`

**Decisión:** el reparto se hace por *momento de inyección*, no por tema.

| Contenido | Destino |
|---|---|
| Stack, dominios, separación de ficheros, Asfalto Nocturno, seguridad, idioma, `memory/` | `context:` |
| Formato de AC, granularidad de tareas, política de dependencias, ADRs | `rules:` por artefacto |
| TDD RED-GREEN-REFACTOR, quality gates, `data-cy` al crear, JSDoc, tokens | `operations.apply.guidance` |
| Revisión CRÍTICO + veredicto + mapeo escenario↔test | `operations.archive.guidance` |
| Regla fundamental, gobernanza de ficheros protegidos, reglas de edición fuera del flujo | `CLAUDE.md` + `.clinerules/00-project-rules.md` |
| Tabla de 6 fases y 7 agentes | **Se elimina, no se mueve** |

**Alternativa descartada:** vaciar `CLAUDE.md` por completo dejando solo un puntero a `config.yaml`. No funciona: un fix de dos líneas sin ningún change de OpenSpec abierto nunca dispara la inyección de `config.yaml`, y reglas como `data-cy` obligatorio o no hardcodear tokens no están cubiertas por ESLint. Ese residuo es irreducible y se estima en ~30 líneas.

**Consecuencia operativa:** `CLAUDE.md` y `.clinerules/00-project-rules.md` deben contener **lo mismo**. Si divergen, vuelve el problema que esta migración resuelve.

### 2. Los siete subagentes se eliminan, incluido `review-agent`

**Decisión:** se borran los 7 `.claude/agents/*.md` y los 7 comandos `.claude/commands/sdd-*.md`. El criterio de revisión vive en `operations.archive.guidance`, que ejecuta `/opsx:archive`.

**Racional:** mantener `review-agent` como subagente de Claude reintroduce exactamente el problema que causó este cambio — el criterio de revisión existiendo solo para una de las dos herramientas. En `archive.guidance` lo leen Cline y Claude por igual.

**Trade-off aceptado y no trivial:** se pierde la revisión en **contexto fresco**. Un subagente independiente no había visto la implementación y por tanto no podía dar por buenas sus propias justificaciones; `/opsx:archive` corre en el mismo contexto que acaba de implementar. La mitigación es que `archive.guidance` exige por escrito re-ejecutar la suite completa y no aceptar el resumen de implementación como bueno — pero es una instrucción, no una garantía estructural. Precedente real en el repositorio: en la sesión de `cobertura-e2e` el `review-agent` encontró dos gaps que el resumen de implementación no reportaba.

**Si el trade-off resulta caro**, la vuelta atrás es barata y no rompe la agnosticidad: reintroducir un único subagente fino cuyo contenido sea "ejecuta el gate descrito en `operations.archive.guidance`", sin duplicar el criterio. Se evalúa tras los primeros cambios cerrados con el flujo nuevo.

**Desviación de ADR-027**, cuyas Consecuencias decían que los agentes se *realinean* en vez de eliminarse. Se registra una nota de actualización en la ADR: al bajar al detalle, cuatro de los siete se disolvían por completo en artefactos y operaciones, y realinear los otros tres habría dejado dos fuentes de criterio para lo mismo.

### 3. `task-agent` se elimina sin sustituto

`tasks.md` con checkboxes es la única trazabilidad de progreso. No se crean issues de GitHub. Ya está codificado como regla del artefacto `tasks` en `config.yaml`.

**Consecuencia:** las issues abiertas de features cerradas (#66-#80 de `perfil-usuario`, y #53) dejan de tener flujo que las cierre. Su limpieza es trabajo aparte, fuera de este cambio.

### 4. `test-agent` se fusiona dentro del gate de revisión

Su función real (mapear cada criterio de aceptación al test que lo valida) era el paso 5 del `review-agent`. Mantenerlos separados duplicaba el recorrido de la suite. Fusionado en `archive.guidance` como un punto explícito con ruta de fichero por escenario.

### 5. `specs/features/` se congela, no se borra ni se migra

52 ficheros que documentan qué está implementado y por qué. Siguen siendo la mejor referencia del repositorio sobre las 10 features cerradas y `memory/context.md` los cita constantemente.

**Decisión operativa fuerte:** congelado significa **no editar ninguno de sus ficheros**, ni siquiera las 2 referencias históricas a `agents/review-agent.md` que contienen (`mejoras-tecnicas.md`, `deuda-tecnica-auditoria.md`). Son registro histórico de lo que ocurrió, no instrucciones activas. El aviso de congelación va en un fichero nuevo, no dentro de los existentes.

**Alternativa descartada:** mover a `docs/historico/`. Rompería las rutas que `memory/context.md` y las propias specs se citan entre sí, a cambio de nada.

### 6. No se forkea el schema

Un artefacto `review` de primera clase (vía `openspec schema fork`) haría el veredicto rastreable en `openspec status`. Se descarta por ahora: el sistema de artefactos está modelado para la fase de planificación y `/opsx:propose` intentaría generarlo junto al resto, antes de que exista código que revisar. Además obliga a mantener un schema propio, que es la clase de mantenimiento en solitario del que ADR-027 quería salir. `archive.guidance` escribe `review.md` en el directorio del cambio, que viaja al archivo — suficiente para la trazabilidad que se necesita.

## Risks / Trade-offs

- **Pérdida de revisión en contexto fresco** → mitigada por escrito en `archive.guidance`, reevaluar tras los primeros cierres; vuelta atrás definida en Decisión 2.
- **`CLAUDE.md` y `.clinerules/00-project-rules.md` divergen con el tiempo** → se escriben en la misma tarea, con el mismo contenido, y la última tarea del plan verifica explícitamente que coinciden.
- **`config.yaml` crece hasta ser caro en tokens** → se inyecta en cada escritura de artefacto y el proyecto es token-aware por DeepSeek (128K). Estado actual: 3.036 caracteres de `context` más las `rules` del artefacto concreto. Si crece, lo que sobra es `context`, no las `rules`.
- **El sitio VitePress rompe por enlaces muertos** → `docs/03-agentes-skills.md` está en el sidebar de `docs/.vitepress/config.mjs` y referenciado desde otras guías. La tarea de documentación cierra con `pnpm run docs` en verde, incluyendo el gate de cobertura al 70% de `scripts/docs-coverage.mjs`.
- **Reglas que solo existían en la cabeza de un agente borrado** → el borrado de los 7 subagentes es irreversible salvo por git. Antes de borrar, la primera tarea del plan extrae su contenido y confirma que cada regla operativa tiene destino en `config.yaml`. `agents/review-agent.md` sigue recuperable con `git show 801fdd2^:agents/review-agent.md`.
- **No hay riesgo sobre `src/shared/`, Android/WebView, CSP ni dependencias**: este cambio no toca código de producto ni añade ninguna dependencia npm o Cargo.
