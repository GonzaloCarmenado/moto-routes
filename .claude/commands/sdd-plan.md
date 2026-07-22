---
description: Genera el plan de implementación (TDD, paso a paso) a partir de una spec existente
argument-hint: <nombre-feature>
---

Invoca al subagente `plan-agent` (Agent tool, subagent_type: plan-agent) para generar el plan de implementación del feature `$ARGUMENTS`.

El agente debe leer `specs/features/$ARGUMENTS.md`, `memory/context.md` y `memory/decisions.md`, y generar `specs/features/$ARGUMENTS.plan.md` con tareas atómicas, ordenadas por dependencias, tests-first (TDD).
