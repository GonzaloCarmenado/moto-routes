# Configuración de OpenSpec

`openspec/config.yaml` es el **source of truth de la metodología** del proyecto. Todo lo que antes vivía repartido entre siete definiciones de agente, `CLAUDE.md` y `.clinerules` está aquí, en un único fichero que la CLI inyecta automáticamente.

## Por qué un solo fichero

El criterio eliminatorio del ADR-027 al elegir framework fue servir **a la vez** a Cline+DeepSeek y a Claude Code desde una sola fuente. OpenSpec lo consigue porque la propia CLI es la capa agnóstica:

```
                openspec/config.yaml
                 (fuente única)
                         │
          openspec instructions <artefacto>
            ↙                          ↘
   .clinerules/workflows/        .claude/commands/opsx/
       opsx-*.md                   + .claude/skills/
   (envoltorio fino)              (envoltorio fino)
            ↘                          ↙
              Cline+DeepSeek · Claude Code
```

Los ficheros generados por `openspec init --tools claude,cline` no contienen metodología: solo dicen "ejecuta la CLI". Las reglas viajan por dentro de `openspec instructions`.

## Estructura del fichero

```yaml
schema: spec-driven

context: |
  # Inyectado al escribir CUALQUIER artefacto

rules:
  proposal: [...]   # Solo al escribir proposal.md
  specs:    [...]   # Solo al escribir delta specs
  design:   [...]   # Solo al escribir design.md
  tasks:    [...]   # Solo al escribir tasks.md

operations:
  apply:
    guidance: [...]  # Durante la implementación
  archive:
    guidance: [...]  # Durante el cierre
```

### `context`

Se inyecta siempre que se escribe un artefacto. Contiene lo que un agente necesita saber del proyecto para no proponer algo incoherente: stack, estructura por dominio funcional, separación de ficheros, diseño "Asfalto Nocturno" y sus tokens, `data-cy` obligatorio, seguridad, idioma, papel de `memory/` y estado congelado de `specs/features/`.

Es el campo más caro en tokens: se paga en cada escritura de artefacto. Si crece de más, lo que se recorta es `context`, no las `rules`.

### `rules`

Reglas específicas por artefacto, indexadas por su id. Solo se inyectan al escribir **ese** artefacto, así que salen gratis el resto del tiempo.

| Artefacto | Ejemplos de reglas |
|---|---|
| `proposal` | Español y conciso · citar rutas reales en Impact · revisar ADRs antes de proponer · `skip_specs` solo sin comportamiento nuevo |
| `specs` | Prosa española con keywords en inglés · cada escenario testable · errores y límites, no solo happy path · preguntar ante ambigüedad |
| `design` | ADRs a `memory/decisions.md`, enlazadas no duplicadas · dependencia nueva justificada · restricción Android/WebView · declarar impacto en `src/shared/` |
| `tasks` | Orden TDD · cada tarea cabe en una sesión · sin issues de GitHub · verificación en Android real cuando aplica · cerrar actualizando `memory/` |

### `operations`

Guía advisory para las dos operaciones que no son de planificación.

**`apply`** — disciplina de implementación: TDD RED-GREEN-REFACTOR con ejecución real, quality gates antes de marcar cada tarea, cobertura ≥80%, `data-cy` y JSDoc al crear, tipos estrictos sin `unwrap()` injustificado, nada de scope creep, ninguna dependencia sin confirmar.

**`archive`** — el gate de cierre: verificación independiente, mapeo escenario↔test, sección CRÍTICO, categorías de hallazgo y veredicto. Ver [02-workflow-sdd.md](02-workflow-sdd.md).

## Dónde aterrizó cada agente del SDD anterior

Hasta agosto de 2026 el proyecto tenía siete subagentes en `agents/` y `.claude/agents/`. Todos se eliminaron. Esto es dónde vive ahora su criterio:

| Agente | Hacía | Ahora |
|---|---|---|
| `spec-agent` | Requisito → spec con AC en Gherkin | Artefactos `proposal` + `specs` |
| `plan-agent` | Spec → plan TDD paso a paso | Artefactos `design` + `tasks` |
| `task-agent` | Plan → issues de GitHub | **Eliminado sin sustituto.** `tasks.md` es la única trazabilidad |
| `impl-agent` | Implementar con TDD estricto | `operations.apply.guidance` |
| `review-agent` | Revisar contra spec, CRÍTICO, veredicto | `operations.archive.guidance` |
| `test-agent` | Mapear cada AC a su test | Fusionado en `operations.archive.guidance` |
| `init-agent` | Scaffolding desde plantilla | **Obsoleto.** El proyecto está inicializado |

La constancia de que ninguna regla operativa se perdió en el traslado está en el propio cambio de migración (`notas-migracion-agentes.md`): 10 reglas se rescataron como nuevas entradas de `config.yaml` y 9 se descartaron con motivo explícito.

**Trade-off conocido:** al eliminar `review-agent` como subagente se pierde la revisión en *contexto fresco* — `/opsx:archive` corre en el mismo contexto que acaba de implementar. La mitigación es que `archive.guidance` exige por escrito re-ejecutar la suite y no fiarse del resumen de implementación, pero es una instrucción, no una garantía estructural. Si resulta caro, la vuelta atrás es reintroducir un subagente fino que solo diga "ejecuta el gate de `archive.guidance`", sin duplicar el criterio.

## Qué NO va en `config.yaml`

`config.yaml` se inyecta al escribir un artefacto o al ejecutar `apply`/`archive`. `CLAUDE.md` y `.clinerules/00-project-rules.md` se cargan **siempre**, en cada turno. Son mecanismos con alcance distinto.

Por eso siguen existiendo esos dos ficheros, con lo que aplica fuera del flujo de artefactos: la regla fundamental, las reglas de edición que no cubre ESLint (`data-cy`, tokens, CSS inline, `shared/`), el puntero a `memory/` y la gobernanza de ficheros protegidos. Ambos deben contener **lo mismo** — si divergen, vuelve el problema que la migración resolvió.

## Extender la configuración

```bash
openspec schema fork spec-driven   # copia el schema al proyecto para editarlo
openspec templates                 # ver de dónde resuelve cada plantilla
openspec schema validate           # validar un schema propio
```

Forkear el schema permite añadir artefactos propios. **El proyecto no lo hace hoy**, deliberadamente: el sistema de artefactos está modelado para la fase de planificación, así que un artefacto de revisión post-implementación iría a contrapelo (`/opsx:propose` intentaría generarlo antes de que exista código que revisar), y mantener un schema propio es la clase de mantenimiento en solitario del que el ADR-027 quería salir.

## Verificar que la configuración llega

```bash
openspec instructions proposal --change <cambio> --json
```

Los campos `context` y `rules` de la respuesta deben venir rellenos. Si están vacíos, el fichero no está siendo leído: comprobar que `openspec doctor` resuelve el root correcto y que el YAML parsea.
