# `specs/` — histórico congelado

Este directorio contiene las especificaciones del **SDD propio** que el proyecto usó hasta agosto de 2026, antes de migrar a OpenSpec (ver [ADR-027](../memory/decisions.md) y `docs/01-arquitectura-sdd.md`).

## Estado: congelado

**Se consulta, no se amplía.** Todo cambio nuevo pasa por `openspec/changes/` con el flujo `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

| Directorio | Contenido | Estado |
|---|---|---|
| `features/` | 10 features cerradas, en formato `<feature>.md` + `.plan.md` + `.review.md` | **Congelado.** No se edita ningún fichero |
| `ui/design-system.md` | Filosofía visual "Asfalto Nocturno" | **Vigente.** Sigue siendo el source of truth del diseño |
| `ui/frontend-conventions.md` | Convenciones de estructura y ficheros del frontend | **Vigente.** Referenciado desde `openspec/config.yaml` |

## Por qué se conserva

`features/` documenta qué está implementado y por qué, con sus criterios de aceptación y el veredicto de revisión de cada uno. `memory/context.md` lo cita constantemente. Es la mejor referencia disponible sobre las diez features cerradas y perderla no aportaría nada.

No se migra al formato de delta specs: la guía oficial de adopción brownfield de OpenSpec lo desaconseja explícitamente — *"You do not document your whole codebase to start. You write specs only for what you're about to change"*.

## Reglas

- **No editar ningún fichero de `features/`**, ni siquiera para corregir referencias a ficheros que ya no existen (por ejemplo, las menciones a `agents/review-agent.md` en `mejoras-tecnicas.md` y `deuda-tecnica-auditoria.md`). Son registro histórico de lo que ocurrió en su momento, no instrucciones activas.
- **No crear specs nuevas aquí.** Si un cambio necesita describir comportamiento, va en `openspec/changes/<cambio>/specs/`.
- `ui/` sí es editable: sigue siendo documentación viva del diseño y las convenciones.
