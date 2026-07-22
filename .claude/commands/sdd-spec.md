---
description: Genera/actualiza una spec SDD a partir de un requisito en lenguaje natural
argument-hint: <requisito en lenguaje natural>
---

Invoca al subagente `spec-agent` (Agent tool, subagent_type: spec-agent) con el siguiente requisito de usuario para el proyecto Moto Routes:

$ARGUMENTS

El agente debe leer `memory/context.md` y `memory/decisions.md`, y generar o actualizar la spec correspondiente en `specs/features/<feature>.md` siguiendo la plantilla estándar del proyecto. Si el requisito es ambiguo, debe preguntar antes de escribir la spec.
