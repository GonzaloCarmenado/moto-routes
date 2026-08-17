## 1. Esquema y taxonomía

- [x] 1.1 Crear `memory/metrics/README.md` con el esquema JSONL completo (campos, taxonomía de 5 categorías + `other`, ejemplo de línea) tal como se define en `design.md` — Decisiones 3 y 5.
- [x] 1.2 Crear `memory/metrics/events.jsonl` (append-only).
- [x] 1.3 Sembrar en `events.jsonl` el evento real ya detectado en esta misma sesión (uso de `ScheduleWakeup` fuera de un contexto `/loop`, categoría `other`, `detected_by: self`) — primer caso real que valida el esquema antes de cerrar el cambio, en vez de dejarlo puramente teórico (ver design.md, Goals).

## 2. Reglas de proceso

- [x] 2.1 Añadir sección nueva a `CLAUDE.md` ("Métricas de fallos del SDLC") con la regla de cuándo y cómo registrar un evento, enlazando `memory/metrics/README.md` para el esquema completo — corta, sin duplicar el contenido del README.
- [x] 2.2 Ampliar `operations.archive.guidance` en `openspec/config.yaml`: si al archivar se detecta desalineación entre código y artefactos, o un gate que falló tras haberse dado por bueno, registrar el evento correspondiente en `memory/metrics/events.jsonl` antes de cerrar el cambio.

## 3. Verificación

- [x] 3.1 Confirmar que `events.jsonl` es JSON válido línea a línea (cada línea parseable por separado, no como array).
- [x] 3.2 `openspec validate --all` — confirmar que el cambio no rompe ninguna spec existente (este cambio no aporta specs propias, `skip_specs: true`).
- [x] 3.3 Verificar que `openspec instructions archive --change metricas-sdlc-agente --json` sirve el texto nuevo de `operations.archive.guidance` — mismo método de verificación ya usado en `criterio-adr` (ADR-048).

## 4. Cierre

- [x] 4.1 Añadir ADR nueva a `memory/decisions.md` (siguiente número libre tras ADR-048) recogiendo las Decisiones 1-4 de `design.md` y sus alternativas descartadas, con el formato ya establecido del fichero.
- [x] 4.2 Actualizar `memory/context.md` con el estado resultante de esta sesión.
