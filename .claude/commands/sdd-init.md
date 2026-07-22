---
description: Inicializa el scaffolding de un stack nuevo a partir de una plantilla (uso puntual, no para features)
argument-hint: <vite-vanilla-ts | tauri-vanilla-ts>
---

Invoca al subagente `init-agent` (Agent tool, subagent_type: init-agent) para inicializar el proyecto con la plantilla `$ARGUMENTS`.

Nota: Moto Routes ya está inicializado con `tauri-vanilla-ts`. Este comando solo tiene sentido para un re-init deliberado o para bootstrapear un proyecto hermano nuevo — confirma con el usuario la intención antes de ejecutar.
