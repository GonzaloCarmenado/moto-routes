---
description: Crea issues de GitHub a partir de un plan de implementación existente
argument-hint: <nombre-feature>
---

Invoca al subagente `task-agent` (Agent tool, subagent_type: task-agent) para crear los issues de GitHub del feature `$ARGUMENTS`.

El agente debe leer `specs/features/$ARGUMENTS.plan.md`, verificar que `gh` está autenticado y que no hay issues duplicados, crear un issue por paso del plan con labels `feature`, `$ARGUMENTS`, `spec-driven`, y actualizar el plan con las URLs de los issues creados.
