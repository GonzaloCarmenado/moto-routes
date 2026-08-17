## Context

Ver `proposal.md` — Why. Lo relevante para el diseño es qué falta hoy y por qué no basta con lo que ya existe: `memory/context.md` documenta hallazgos puntuales dentro de la narrativa de cada sesión (p. ej. ADR-036 release rota, los tres hallazgos de CI de `sistema-logros`), pero no hay ningún sitio que los agregue por categoría o frecuencia — cada uno vive aislado en su propia entrada de sesión, en prosa. Tampoco hay ningún gate técnico ni hook que detecte estos fallos automáticamente hoy.

`openspec/config.yaml` inyecta reglas solo en el momento de escribir cada artefacto (`propose`, `design`, `tasks`, `archive`), es decir, solo dentro del flujo `/opsx:*`. Varios de los fallos que se quieren capturar ocurren fuera de ese flujo — un `git push` suelto, una PR fusionada sin pasar los gates, un fix puntual sin cambio OpenSpec abierto (permitido explícitamente por `CLAUDE.md`) — así que la regla de "cuándo registrar un evento" no puede depender solo de la inyección de OpenSpec.

## Goals / Non-Goals

**Goals:**

- Definir una taxonomía cerrada y pequeña de categorías de fallo del SDLC, para que el análisis posterior pueda agregar por categoría sin normalizar texto libre primero.
- Definir un formato de registro estructurado (no prosa) que se pueda analizar mecánicamente dentro de unos días, sin instalar tooling nuevo.
- Que la regla de "cuándo registrar" viva en un sitio que se lea siempre (`CLAUDE.md`), no solo en las reglas que OpenSpec inyecta dentro de `/opsx:*`.
- Sembrar el log con los primeros eventos reales ya conocidos de esta sesión (si los hay), para no cerrar este cambio con un mecanismo puramente teórico y sin validar.

**Non-Goals:**

- Ningún dashboard, script de agregación ni análisis todavía — es un cambio futuro aparte, después de recopilar datos varios días (ver `proposal.md`).
- Ninguna métrica de productividad, KPI, coste de tokens o tablero — explícitamente fuera de alcance.
- Ningún gate técnico que bloquee un commit o una PR si no se registró un evento — disciplina documentada, no automatizada, al menos en esta primera fase (ver Decisión 4).
- No se audita retroactivamente todo `memory/context.md` histórico para "rellenar" datos pasados con la taxonomía nueva — se arranca hacia adelante desde este cambio; recodificar la narrativa histórica sería trabajo manual grande de valor dudoso frente a recopilar bien de aquí en adelante.

## Decisions

### 1. Ubicación: `memory/metrics/` nuevo, no `docs/` ni dentro de `memory/context.md`

`memory/` ya es "memoria del proyecto, no de la app" — coherente con dónde debe vivir. Se separa de `context.md` (narrativa en prosa, una entrada larga por sesión) porque este es un log de eventos de grano mucho más fino (puede haber varios eventos por sesión) — mezclarlo en `context.md` rompería tanto la legibilidad narrativa existente como la posibilidad de procesar el log mecánicamente.

**Alternativas descartadas:** (a) `docs/` — es documentación generada/transversal (VitePress/TypeDoc), no memoria activa que un agente escribe cada sesión. (b) Tabla markdown dentro de `context.md` — mezcla dos granularidades y formatos distintos, ver arriba. (c) SQLite local (ya usado en `apps/mobile`) — dependencia de tooling nueva (`sqlite3` CLI) para analizar, sin beneficio real a esta escala (decenas/cientos de eventos en unos días), y deja de ser texto diffable en git como el resto de `memory/`.

### 2. Formato: JSON Lines (un objeto JSON por línea), no markdown

Analizable mecánicamente sin parser propio cuando llegue la fase de análisis. Append-only: cada evento es una línea nueva sin reescribir el fichero, así que el riesgo de conflicto de merge entre sesiones o ramas es bajo.

**Alternativas descartadas:** (a) Tabla markdown — cualquier campo con comas, saltos de línea o `|` rompe la tabla y exige escapado manual; JSON no tiene ese problema. (b) CSV — JSON anida mejor campos que solo aplican a una categoría (p. ej. una URL de PR solo tiene sentido en `gate-bypass`) sin columnas vacías por todas partes.

### 3. Taxonomía cerrada de 5 categorías, con válvula de escape

- `memory-miss`: el agente actuó sin haber leído o aplicado algo ya documentado en `memory/context.md` o `memory/decisions.md` — contradice una ADR, repite un error ya resuelto, pierde contexto de una sesión anterior.
- `gate-bypass`: el agente lanzó una acción (commit, push, merge, apertura de PR) sin haber pasado localmente los quality gates requeridos, y falló después — en el propio pre-commit hook o en CI.
- `scope-violation`: el agente tocó un fichero bajo autorización explícita de `CLAUDE.md` (`openspec/config.yaml`, `CLAUDE.md`, `.clinerules/`, `.claude/commands/`, `.claude/skills/`, `specs/`) sin avisar antes, o hizo push directo a `master` en vez de rama+PR.
- `spec-drift`: al cerrar un cambio (`/opsx:archive` o revisión manual), código y artefactos OpenSpec quedaron desalineados — viola la "Regla fundamental" de `CLAUDE.md`.
- `rework`: el usuario tuvo que corregir el enfoque técnico del agente dentro de la misma tarea (un error real de enfoque, no una preferencia de estilo).
- `other`: cualquier fallo real de proceso que no encaje en las cinco anteriores, con el detalle en `description` — señal para revisar la taxonomía en el cambio de análisis posterior, en vez de forzar una categoría que no encaja o no registrar nada.

**Alternativa descartada:** categorías abiertas (texto libre desde el principio) — con texto libre, el análisis de "dónde falla más" exigiría normalizar manualmente decenas de strings parecidos pero no idénticos antes de poder contar nada; una taxonomía cerrada con válvula de escape da lo mejor de ambas.

### 4. Quién registra y cuándo: el propio agente, de forma proactiva — sin hook técnico

Coherente con [[ADR-029]]/[[ADR-030]]: este proyecto ya eligió conscientemente disciplina documentada sobre gate técnico para su propio flujo de trabajo (rama+PR, tablero). Un hook (p. ej. en `.husky/pre-commit`) podría detectar mecánicamente parte de `gate-bypass` mirando el historial de comandos, pero no puede detectar `memory-miss` ni `rework` (son de juicio, no de estructura) — automatizar solo una de cinco categorías no simplifica lo suficiente para justificar la complejidad añadida, y contradice el alcance de esta fase (solo recopilación).

El campo `detected_by` (`self` | `user`) existe precisamente para medir en el análisis posterior el sesgo de que sea el propio agente quien decide si se equivocó, no para evitarlo ahora.

### 5. Esquema del evento

```json
{
  "date": "2026-08-17",
  "change": "metricas-sdlc-agente",
  "stage": "propose",
  "category": "memory-miss",
  "detected_by": "self",
  "description": "..."
}
```

- `date`: fecha ISO (`YYYY-MM-DD`) — granularidad diaria, suficiente para el agregado posterior, sin necesidad de hora.
- `change`: nombre del cambio OpenSpec en curso, o `"none"` si el fallo ocurrió fuera de un cambio abierto (p. ej. una acción de git suelta) — el caso que un gate dentro de `/opsx:*` no vería.
- `stage`: fase del SDLC en la que ocurrió — `propose` | `apply` | `archive` | `commit` | `ci` | `review` | `other`.
- `category`: una de las de la Decisión 3.
- `detected_by`: `self` (el agente se dio cuenta sin que el usuario lo señalara) | `user` (el usuario lo señaló).
- `description`: una frase concreta — qué pasó y por qué, con ruta de fichero o número de PR si aplica. Mismo criterio de concisión que ya rige `memory/context.md`.

## Risks / Trade-offs

- **Sesgo de auto-reporte**: el propio agente que falla decide si registra el fallo — puede no darse cuenta de sus propios `memory-miss`. → Mitigación parcial: `detected_by` permite medir en el análisis posterior qué fracción de eventos detectó el usuario en vez del propio agente, como proxy de lo que se está perdiendo. Sin mitigación completa posible sin tooling externo, fuera de alcance de esta fase.
- **El log puede quedar vacío si nadie lo recuerda**: sin gate técnico, depende de que cada sesión (de este agente o de otro) aplique la regla de `CLAUDE.md`. → Mitigación: la regla vive en `CLAUDE.md` (leído siempre), no solo en `openspec/config.yaml` (inyectado solo en `/opsx:*`); y este mismo cambio siembra el log con los primeros eventos reales conocidos (ver `tasks.md`), para no cerrarlo puramente teórico.
- **La taxonomía puede no encajar con lo que realmente aparece**: 5 categorías es una apuesta inicial sin datos todavía. → Mitigación: `other` como válvula de escape, pensado para revisar la taxonomía en el cambio de análisis posterior.
- **JSONL no es cómodo para una revisión visual casual**, a diferencia de `context.md`. → Aceptado conscientemente: `memory/metrics/README.md` documenta cómo volcarlo de forma legible cuando haga falta — no se duplica el contenido en un segundo formato paralelo, para no tener dos fuentes que puedan desincronizarse.

## Migration Plan

Sin migración de datos existente — es un mecanismo nuevo, no hay log previo que convertir. Pasos: crear `memory/metrics/README.md` (esquema completo) y `memory/metrics/events.jsonl` (con los eventos reales ya conocidos de esta sesión, si los hay, o vacío si no); añadir la sección nueva a `CLAUDE.md`; ampliar `operations.archive.guidance` en `openspec/config.yaml`. Reversión: `git revert` del commit — no hay estado persistido fuera de estos ficheros nuevos, ningún build ni despliegue afectado.

Este mecanismo (ubicación, formato, taxonomía cerrada, quién registra) merece ADR según el criterio de `rules.design` ([[ADR-048]]): hay alternativas reales evaluadas y descartadas en las Decisiones 1-4, y revertir esta elección más adelante (p. ej. pasar de JSONL a otro almacén tras acumular datos) obligaría a migrar el log ya recopilado. Se registra en `memory/decisions.md` como tarea de `tasks.md`, no aquí, para no duplicar contenido — número de ADR a confirmar en el momento de crear la entrada (siguiente libre tras [[ADR-048]]).
