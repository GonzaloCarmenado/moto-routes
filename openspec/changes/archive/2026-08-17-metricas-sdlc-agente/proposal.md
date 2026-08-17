## Why

Este proyecto ya documenta *qué* falló puntualmente (ADR-036 release rota, ADR-037 falso positivo de permiso GPS, los tres hallazgos de CI en `sistema-logros`...) pero cada hallazgo vive aislado en su propia sesión de `memory/context.md`, sin ningún sitio que agregue "dónde falla el propio proceso, con qué frecuencia y en qué fase". No hay forma de responder hoy a: ¿en qué tarea se equivoca más el agente?, ¿cuántas veces se lanzó un commit/push/PR sin pasar los quality gates y falló después?, ¿cuántas veces no leyó bien la memoria antes de actuar?

Este cambio **no** es la solución — es solo el plan de recopilación. Define qué eventos se registran, dónde y con qué formato, para acumular datos reales unos días y analizarlos después en un cambio aparte. Fuera de alcance: tokens, productividad, velocidad o KPI/board — el objetivo único es identificar fallos reales del SDLC.

## What Changes

- Nueva sección corta en `CLAUDE.md` ("Métricas de fallos del SDLC") con la regla de cuándo y cómo registrar un evento — aplica siempre, no solo dentro del flujo `/opsx:*`, porque varios de los fallos a capturar (p. ej. lanzar un `git push` sin pasar los gates) ocurren fuera de OpenSpec.
- Nuevo log append-only `memory/metrics/events.jsonl` (JSON Lines, un evento por línea) con un esquema fijo de campos y una taxonomía cerrada de categorías (definida en `memory/metrics/README.md`).
- Ajuste puntual en `openspec/config.yaml` (`operations.archive.guidance`) para que, si `archive` encuentra desalineación entre código y artefactos (la propia "Regla fundamental" de `CLAUDE.md`) o un gate que falló tras haberse dado por bueno, quede registrado como evento antes de cerrar el cambio.
- Sin mecanismo de análisis ni dashboard todavía — **BREAKING** no aplica (no hay comportamiento previo que romper, es un mecanismo nuevo).

## Capabilities

Sin capacidades de aplicación nuevas ni modificadas — es instrumentación del propio proceso de trabajo (CLAUDE.md, config.yaml, memory/), no una funcionalidad de `apps/mobile` ni de `apps/api`. `skip_specs: true` en `.openspec.yaml` (ya declarado).

## Impact

- `CLAUDE.md` — nueva sección, sin tocar las reglas existentes de git/edición/idioma.
- `openspec/config.yaml` — una entrada nueva o ampliada en `operations.archive.guidance`. Bajo autorización explícita de `CLAUDE.md` — el usuario ha pedido este cambio directamente en esta sesión, ver `memory/context.md`.
- `memory/metrics/` (nuevo) — `README.md` (esquema/taxonomía) + `events.jsonl` (log vacío o con los primeros eventos reales de esta misma sesión, si los hay).
- Sin cambios en `apps/mobile`, `apps/api`, `infra/`, dependencias ni CI (`ci.yml` no se toca en esta fase — no hay validación automática del log todavía, es fase de recopilación manual/asistida).
