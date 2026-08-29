## 1. Preparación

- [x] 1.1 Releer los 15 eventos de `memory/metrics/events.jsonl` (2026-08-17 a 2026-08-27) y la taxonomía de `memory/metrics/README.md`.
- [x] 1.2 Por cada evento, anotar en una tabla de trabajo: fecha, `change`, `stage`, `category`, `detected_by`, y una etiqueta corta de "patrón" (p. ej. `docker-no-arrancado`, `gate-solo-en-ci`, `segundo-proceso-sin-verificar`) — varios eventos comparten patrón aunque su `category` difiera.
- [x] 1.3 Cruzar cada patrón detectado contra `memory/context.md` y `memory/decisions.md`: ¿ya había una lección o ADR documentada para ese mismo patrón antes del evento? Anotarlo (indica que documentar no bastó, no que falte documentación).

## 2. Análisis

- [x] 2.1 Calcular la distribución de eventos por `category` y por `stage` (conteo simple, 15 eventos totales).
- [x] 2.2 Identificar los patrones que aparecen en más de un evento (repetición entre sesiones distintas) y separarlos de los que son casos únicos.
- [x] 2.3 Para cada patrón recurrente, redactar una recomendación concreta y accionable: qué artefacto cambiaría (`CLAUDE.md`, `openspec/config.yaml`, `.husky/pre-commit`, `.github/workflows/ci.yml`, `memory/context.md`) y qué cambiaría en él — sin aplicar el cambio, solo proponerlo.
- [x] 2.4 Para los casos únicos (no recurrentes), decidir si merecen mención como riesgo a vigilar o si se dejan fuera del informe por no tener patrón que corregir.

## 3. Redacción del informe

- [x] 3.1 Escribir `memory/metrics/analisis-2026-08-17-2026-08-27.md` con: resumen de la distribución (2.1), lista de patrones recurrentes con su evidencia (qué eventos los muestran) y su recomendación (2.3), y una nota sobre los casos donde documentar ya no bastó (1.3).
- [x] 3.2 Añadir al final del informe una sección corta de "siguientes pasos" listando, sin aplicarlos, los cambios de procedimiento recomendados como candidatos a un cambio OpenSpec futuro.
- [x] 3.3 Enlazar el informe nuevo desde `memory/metrics/README.md` (una línea, junto a "Cómo revisar el log").

## 4. Cierre

- [x] 4.1 Actualizar `memory/context.md` (Estado Actual del Proyecto) con el cierre de este cambio y el resumen de hallazgos en una frase.
- [x] 4.2 `openspec validate --change analisis-metricas-sdlc --strict`.
- [ ] 4.3 `/opsx:archive` y PR de `feature/analisis-metricas-sdlc` → `master`.
