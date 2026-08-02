# Workflow SDD (Spec-Driven Development)

## Flujo de Trabajo Detallado

Este documento describe el proceso paso a paso para desarrollar cualquier cambio en Moto Routes con OpenSpec. Funciona igual desde Claude Code (comandos `/opsx:*`) que desde Cline + DeepSeek (workflows `/opsx-*` en `.clinerules/workflows/`): ambos ejecutan la misma CLI y reciben las mismas instrucciones desde `openspec/config.yaml`.

## Resumen del Workflow

```
IDEA / REQUISITO / BUG
    │
    ▼
┌──────────────────┐
│  /opsx:explore   │  (opcional, en cualquier momento)
└──────────────────┘  pensar, investigar el código, comparar opciones
    │
    ▼
┌──────────────────┐
│  /opsx:propose   │──→ openspec/changes/<cambio>/
└──────────────────┘      proposal.md · specs/ · design.md · tasks.md
    │
    ▼
┌──────────────────┐
│   /opsx:apply    │──→ src/ + tests (TDD estricto)
└──────────────────┘      checkboxes de tasks.md marcados
    │
    ▼
┌──────────────────┐
│  /opsx:archive   │──→ review.md + veredicto
└──────────────────┘      deltas fundidos en openspec/specs/
                          cambio movido al archivo
```

## Fase 1 — Propose

```bash
/opsx:propose "<descripción de lo que quieres construir>"
```

Crea el directorio del cambio y genera todos sus artefactos en un solo paso.

**Artefactos del schema `spec-driven`:**

| Artefacto | Fichero | Contiene | Depende de |
|---|---|---|---|
| `proposal` | `proposal.md` | Por qué, qué cambia, capabilities, impacto | — |
| `specs` | `specs/<capability>/spec.md` | Delta spec: `ADDED` / `MODIFIED` / `REMOVED` | `proposal` |
| `design` | `design.md` | Decisiones técnicas, riesgos, alternativas | `proposal` |
| `tasks` | `tasks.md` | Pasos con checkbox, ordenados por TDD | `specs` + `design` |

**Delta specs.** Una spec de cambio no describe el sistema entero, solo la diferencia:

```markdown
## ADDED Requirements

### Requirement: Límite de fotos por ruta
El sistema SHALL impedir añadir más de 100 fotos a una misma ruta.

#### Scenario: Ruta con el límite alcanzado
- **WHEN** la ruta ya tiene 100 fotos y el usuario abre el detalle
- **THEN** el botón de añadir foto aparece deshabilitado con el texto
  "Límite de fotos alcanzado"
```

La prosa va en español; `Requirement`, `Scenario`, `WHEN`/`THEN` y `ADDED`/`MODIFIED`/`REMOVED` van en inglés porque los valida la CLI.

**Cambios sin comportamiento.** Un refactor puro, un cambio de tooling o de documentación no tiene delta spec. Se declara en el `.openspec.yaml` del cambio:

```yaml
skip_specs: true
```

Sin ese marcador, `openspec validate` rechaza un cambio con cero deltas. No inventes un requisito para pasar la validación.

**`design.md` es condicional.** Se crea si hay decisiones técnicas que tomar: cambio transversal, dependencia nueva, modelo de datos, seguridad, migración o ambigüedad que conviene resolver antes de escribir código. Para un cambio pequeño y evidente, se omite.

## Fase 2 — Apply

```bash
/opsx:apply <cambio>
```

Recorre los checkboxes de `tasks.md` en orden, implementando cada uno y marcándolo al terminar.

**Disciplina de implementación** (viene de `operations.apply.guidance` en `openspec/config.yaml`):

1. **TDD estricto RED-GREEN-REFACTOR.** Escribe el test, **ejecútalo y confirma que falla**, implementa lo mínimo para ponerlo en verde, refactoriza, vuelve a ejecutar. No des un paso por bueno con una revisión visual del código.
2. **Quality gates antes de marcar cada tarea**: `pnpm test`, `tsc --noEmit`, ESLint sin warnings, y en Rust `cargo test` + `cargo clippy -- -D warnings` + `cargo fmt --check`. La cobertura de Vitest no baja del 80%.
3. **Convenciones al crear, no después**: `data-cy` en el propio `.element.ts`, JSDoc en todo símbolo exportado, estilos solo en el `*.element.css` con tokens.
4. **Nada de scope creep.** Si aparece algo que no está en los artefactos, párate y pregunta.
5. **Ninguna dependencia nueva** sin confirmarlo con el usuario, aunque el design la contemple.

**Si aparece un gap** entre el código y los artefactos, se para y se comunica: o se corrige el código o se actualiza el artefacto. Nunca se resuelve con una suposición silenciosa. El flujo no está bloqueado por fases — se puede volver a `/opsx:update` para revisar los artefactos a mitad de la implementación.

## Fase 3 — Archive

```bash
/opsx:archive <cambio>
```

Cierra el cambio: pasa el gate de revisión, funde los deltas en `openspec/specs/` y mueve el cambio al archivo.

**Gate de revisión** (viene de `operations.archive.guidance`). Absorbe lo que antes hacían el `review-agent` y el `test-agent`:

- **Verificación independiente**: releer el código y re-ejecutar la suite completa uno mismo. No se acepta el resumen de la implementación como bueno.
- **Mapeo escenario ↔ test** con ruta de fichero, uno por uno. Los que solo se pueden validar a mano en dispositivo Android real se listan aparte con su estado.
- **Sección CRÍTICO** al principio de `review.md`: seguridad (secretos, CSP, inputs sin validar), cambios en `src/shared/` y su radio de impacto, actualizaciones de dependencias core, y normas del proyecto que se hayan tenido que saltar.
- **Categorías de hallazgo**: gap, desviación, calidad, cobertura, convenciones de frontend. Cada uno con fichero y línea — nunca un "se ve bien" sin evidencia.
- **Veredicto**:

| Veredicto | Cuándo | ¿Archiva? |
|---|---|---|
| `APPROVED` | Todo cumplido y verificado | Sí |
| `APPROVED WITH MINOR ISSUES` | Hallazgos de severidad baja, anotados | Sí |
| `CHANGES REQUESTED` | Escenario sin implementar o incorrecto; norma saltada sin justificar | No |
| `BLOCKED` | Problema de seguridad | No |

Al archivar se actualiza `memory/context.md` con el estado resultante, y `memory/decisions.md` si el cambio tomó alguna decisión de arquitectura.

## Comandos de la CLI

```bash
openspec list                              # cambios activos
openspec list --specs                      # specs vivas
openspec status --change <cambio>          # progreso de artefactos y tareas
openspec show <cambio>                     # ver un cambio o spec
openspec validate --all                    # validar todo
openspec doctor                            # salud del root
openspec instructions <artefacto> --change <cambio>   # instrucciones enriquecidas
```

`openspec instructions` es el mecanismo que inyecta `context` y `rules` de `openspec/config.yaml`. Es lo que hace que Cline y Claude Code trabajen con las mismas reglas sin duplicarlas. Ver [03-configuracion-openspec.md](03-configuracion-openspec.md).

## Qué NO gestiona OpenSpec

- **Issues de GitHub.** No se crean. `tasks.md` es la única trazabilidad de progreso de un cambio.
- **`memory/`.** El estado acumulado del proyecto y los ADRs son responsabilidad del equipo, no del framework.
- **Los gates con dientes.** `rules` y `guidance` son instrucciones para el agente, no comprobaciones ejecutables. El único gate que bloquea de verdad es el pre-commit de Husky.
- **El histórico.** `specs/features/` documenta las 10 features cerradas con el SDD anterior y está congelado. Ver `specs/README.md`.
