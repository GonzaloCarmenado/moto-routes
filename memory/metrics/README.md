# Métricas de fallos del SDLC

Log de eventos de proceso — no de la app, no de tokens, no de productividad. Registra dónde falla el propio flujo de trabajar con un agente en este repo (OpenSpec, `CLAUDE.md`, memoria), para poder analizarlo después de acumular datos reales durante unos días. Ver el cambio OpenSpec `metricas-sdlc-agente` (`openspec/changes/metricas-sdlc-agente/`, o su versión archivada) para el porqué y las alternativas descartadas.

**Fase actual: solo recopilación.** No hay ningún script de agregación ni dashboard todavía — eso es un cambio futuro aparte, una vez haya datos suficientes.

## Formato

`events.jsonl` — JSON Lines: un objeto JSON por línea, append-only. Nunca se reescriben líneas ya escritas; un evento nuevo siempre se añade al final.

### Campos

| Campo | Tipo | Descripción |
|---|---|---|
| `date` | string | Fecha ISO `YYYY-MM-DD`. Granularidad diaria, sin hora. |
| `change` | string | Nombre del cambio OpenSpec en curso (kebab-case), o `"none"` si el fallo ocurrió fuera de un cambio abierto (p. ej. una acción de git suelta, un fix puntual). |
| `stage` | string | Fase del SDLC en la que ocurrió: `propose` \| `apply` \| `archive` \| `commit` \| `ci` \| `review` \| `other`. |
| `category` | string | Una de las categorías de abajo. |
| `detected_by` | string | `self` (el agente se dio cuenta sin que el usuario lo señalara) \| `user` (el usuario lo señaló). |
| `description` | string | Una frase concreta: qué pasó y por qué, con ruta de fichero o número de PR si aplica. Mismo criterio de concisión que `memory/context.md`. |

### Ejemplo

```json
{"date":"2026-08-17","change":"metricas-sdlc-agente","stage":"other","category":"other","detected_by":"self","description":"Uso de ScheduleWakeup fuera de un contexto /loop (herramienta reservada a ese modo) para esperar un CI, en vez de Bash run_in_background/Monitor."}
```

## Taxonomía (categorías cerradas)

- **`memory-miss`** — el agente actuó sin haber leído o aplicado algo ya documentado en `memory/context.md` o `memory/decisions.md`: contradice una ADR, repite un error ya resuelto, pierde contexto de una sesión anterior.
- **`gate-bypass`** — el agente lanzó una acción (commit, push, merge, apertura de PR) sin haber pasado localmente los quality gates requeridos, y falló después — en el propio pre-commit hook o en CI.
- **`scope-violation`** — el agente tocó un fichero bajo autorización explícita de `CLAUDE.md` (`openspec/config.yaml`, `CLAUDE.md`, `.clinerules/`, `.claude/commands/`, `.claude/skills/`, `specs/`) sin avisar antes, o hizo push directo a `master` en vez de rama+PR.
- **`spec-drift`** — al cerrar un cambio (`/opsx:archive` o revisión manual), código y artefactos OpenSpec quedaron desalineados — viola la "Regla fundamental" de `CLAUDE.md`.
- **`rework`** — el usuario tuvo que corregir el enfoque técnico del agente dentro de la misma tarea (un error real de enfoque, no una preferencia de estilo).
- **`other`** — cualquier fallo real de proceso que no encaje en las cinco anteriores, con el detalle en `description`. Señal para revisar la taxonomía en el cambio de análisis posterior, en vez de forzar una categoría que no encaja o no registrar nada.

## Cuándo registrar

Ver `CLAUDE.md` § Métricas de fallos del SDLC para la regla de cuándo aplica esto durante una sesión normal de trabajo.

## Cómo revisar el log

JSONL no es cómodo para una lectura visual casual. Para revisar rápido sin tooling nuevo:

```powershell
Get-Content memory/metrics/events.jsonl | ForEach-Object { $_ | ConvertFrom-Json } | Format-Table date, change, category, detected_by
```

O simplemente pedirle a un agente que lea el fichero y lo resuma — cada línea es JSON autocontenido, no hace falta parsear el fichero entero para entender una línea suelta.
