---
description: Ejecuta uno o más pasos de un plan de implementación siguiendo TDD estricto
argument-hint: <nombre-feature> [paso N | rango de pasos]
---

Invoca al subagente `impl-agent` (Agent tool, subagent_type: impl-agent) para implementar lo siguiente: `$ARGUMENTS`.

El agente debe interpretar `$ARGUMENTS` como `<nombre-feature>` seguido opcionalmente del paso o pasos a ejecutar (si no se especifica paso, continuar desde el primer paso pendiente marcado sin `[x]` en `specs/features/<feature>.plan.md`). Debe seguir RED → GREEN → REFACTOR, ejecutar la suite de tests tras cada paso, y actualizar el plan marcando los pasos completados.
