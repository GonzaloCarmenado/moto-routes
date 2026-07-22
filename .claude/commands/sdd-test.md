---
description: Valida la cobertura de tests de un feature contra sus criterios de aceptación y genera los que falten
argument-hint: <nombre-feature>
---

Invoca al subagente `test-agent` (Agent tool, subagent_type: test-agent) para validar la cobertura de tests del feature `$ARGUMENTS`.

El agente debe mapear cada AC de `specs/features/$ARGUMENTS.md` a un test existente, ejecutar la suite completa, generar los tests que falten (sin tocar código de producción) y reportar el resultado con el formato estándar de reporte de testing.
