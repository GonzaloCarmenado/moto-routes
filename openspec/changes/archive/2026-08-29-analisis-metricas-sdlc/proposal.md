## Why

`memory/metrics/events.jsonl` lleva desde 2026-08-17 (cambio `metricas-sdlc-agente`) registrando fallos reales de proceso — no de la app — cada vez que se detecta un `memory-miss`, un `gate-bypass`, un `rework` u otra categoría de la taxonomía cerrada. El propio `memory/metrics/README.md` deja dicho desde el principio que la fase actual es "solo recopilación" y que el análisis es "un cambio futuro aparte, una vez haya datos suficientes". Han pasado 10 días y 15 eventos — suficiente volumen para la primera lectura real: ¿qué categorías y qué fase del SDLC concentran los problemas, qué patrones concretos se repiten entre sesiones distintas, y qué cambio de procedimiento (no de código de la app) reduciría cada patrón? Sin este análisis, el log sigue siendo una lista de incidentes sueltos que nadie ha releído en conjunto — varios de los 15 eventos son además repeticiones explícitas de un mismo gotcha ya documentado antes, lo que sugiere que la sola existencia del log no basta para evitar la recaída.

## What Changes

- Nuevo informe de análisis (documento único) que lee los 15 eventos de `memory/metrics/events.jsonl` (2026-08-17 a 2026-08-27, histórico completo) y produce:
  - Distribución de eventos por `category` y por `stage`, señalando dónde se concentran.
  - Identificación de patrones recurrentes entre eventos distintos (mismo gotcha repetido en sesiones diferentes, misma causa raíz con síntoma distinto).
  - Una recomendación concreta por patrón recurrente: qué cambiar en `CLAUDE.md`, `openspec/config.yaml`, `.husky/pre-commit`, `.github/workflows/ci.yml` o `memory/context.md` para que ese patrón deje de repetirse — sin aplicar todavía ninguno de esos cambios.
- No se toca código de aplicación, `CLAUDE.md`, `openspec/config.yaml` ni ningún hook en este cambio — es un cambio de tipo documentación/proceso, `skip_specs: true` (sin comportamiento observable de la app).
- No se construye tooling de agregación reutilizable (script, dashboard) — sigue siendo lectura manual del `.jsonl`, tal como documenta `memory/metrics/README.md` para esta fase. Si el informe concluye que hace falta, queda como recomendación para un cambio futuro, no como parte de este.

## Capabilities

Sin capabilities nuevas ni modificadas — este cambio no introduce ni modifica comportamiento observable del sistema (app móvil, API o panel web). Es un artefacto de análisis de proceso, con `skip_specs: true` en `.openspec.yaml`.

## Impact

- **Nuevo**: un documento de análisis (ubicación exacta a decidir en `design.md` — candidato natural: `memory/metrics/analisis-2026-08-17-2026-08-27.md`, junto al propio log que analiza).
- **Leído, no modificado**: `memory/metrics/events.jsonl` (15 eventos), `memory/metrics/README.md` (taxonomía y formato), `memory/context.md` y `memory/decisions.md` (para contrastar si algún patrón ya tiene una lección o ADR documentada que no se está aplicando).
- **Sin impacto en**: código de `apps/mobile`, `apps/api`, `apps/web`, `CLAUDE.md`, `openspec/config.yaml`, `.husky/`, CI. Cualquier cambio a estos, si el informe lo recomienda, es explícitamente trabajo futuro fuera de este cambio.
