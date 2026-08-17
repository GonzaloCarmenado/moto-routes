# CLAUDE.md — Moto Routes

## Regla fundamental

Este proyecto sigue **Spec-Driven Development con OpenSpec**. No se escribe código sin un cambio abierto en `openspec/changes/`. El ciclo es `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Si el código y los artefactos del cambio divergen, o se corrige el código o se actualiza el artefacto — nunca se dejan desalineados.

## Dónde vive la metodología

**`openspec/config.yaml` es el source of truth del proyecto**: stack, convenciones, diseño, seguridad, disciplina TDD y el gate de revisión. La CLI lo inyecta automáticamente al escribir artefactos y al ejecutar `apply`/`archive`, así que no lo repitas aquí ni lo copies a ningún artefacto. Este fichero solo recoge lo que aplica **fuera** de ese flujo.

Detalle navegable en `docs/` (`pnpm run docs`). Histórico del SDD anterior en `specs/` — congelado, ver `specs/README.md`.

## Flujo de Git y Project

- **Toda spec nueva empieza en su propia rama**: antes de `/opsx:propose`, crear `feature/<nombre-del-cambio>` desde `master`. No se trabaja directamente en `master` — mismo patrón que exigía el SDD anterior (`Ramas: feature/<nombre> desde main`), que la migración a OpenSpec no debía haber relajado.
- **Todo cambio se cierra con un PR a `master`**, nunca con push directo — incluso después de un `/opsx:archive` con veredicto `APPROVED`/`APPROVED WITH MINOR ISSUES`. La descripción del PR referencia el `review.md` ya archivado en `openspec/changes/archive/<fecha>-<cambio>/`.
- Un fix puntual sin cambio OpenSpec abierto (bug urgente, ajuste menor) sigue el mismo patrón: rama + PR, nunca directo a `master`.
- **Esto es disciplina documentada, no un gate técnico**: ningún hook ni configuración de GitHub impide hoy saltárselo (decisión explícita — ver [[ADR-029]] en `memory/decisions.md`). Es responsabilidad de quien commitea, agente o humano, cumplirlo igualmente.
- **Project**: [github.com/orgs/crzverde/projects/1](https://github.com/orgs/crzverde/projects/1) ("Moto Routes"). Una card por **cambio de OpenSpec** (nunca una por tarea de `tasks.md` — eso ya se decidió que no, ver [[ADR-027]]), en el campo `Fase`: `Backlog` (idea sin `openspec/changes/` todavía) → `Propuesto` (`proposal.md` existe) → `En progreso` (`/opsx:apply` en marcha) → `En revisión` (`/opsx:archive` hecho y/o PR abierta sin mergear) → `Hecho` (PR mergeada). Gestión manual, a petición explícita — mismo criterio que rama/PR, sin automatización dentro de los skills (ver [[ADR-030]]).

## Memoria del proyecto (leer al empezar a trabajar aquí)

`memory/` es memoria **del proyecto**, no la memoria personal de Claude. Nadie te la carga automáticamente — léela tú:

- `memory/context.md` — estado actual y próximo hito. Cárgalo antes de tocar código. Incluye la lección aprendida del build de Android: léela antes de tocarlo, no la repitas de memoria.
- `memory/decisions.md` — ADRs. Consúltalo antes de revertir o cuestionar una decisión ya tomada; si tomas una nueva, añade el ADR aquí.
- `memory/sessions/` — resúmenes de sesiones largas.

## Métricas de fallos del SDLC

`memory/metrics/events.jsonl` recoge fallos del propio proceso de trabajar con un agente en este repo — no de la app, no de tokens, no de productividad. Esquema y taxonomía completos en `memory/metrics/README.md`. Esta regla aplica **siempre**, no solo dentro de `/opsx:*` (a diferencia de las reglas de `openspec/config.yaml`, que solo se inyectan al escribir un artefacto): varios de los fallos a capturar ocurren fuera de ese flujo — un `git push` suelto, una PR fusionada sin pasar los gates, un fix puntual sin cambio abierto.

Añade una línea a `events.jsonl` cuando detectes, tú mismo o porque el usuario lo señale, alguno de: no haber leído o aplicado bien `memory/context.md`/`memory/decisions.md` antes de actuar; haber lanzado un commit/push/merge/PR sin pasar los quality gates localmente y haber fallado después (pre-commit o CI); haber tocado algo de "Autorización explícita" sin avisar antes, o haber saltado rama+PR; código y artefactos OpenSpec desalineados al cerrar un cambio; el usuario corrigiendo tu enfoque técnico dentro de la misma tarea. Si el fallo es real pero no encaja en ninguna, se registra igual como `other` — no lo descartes por no encajar. No hay gate técnico que lo fuerce (mismo criterio que [[ADR-029]]/[[ADR-030]]): es responsabilidad de quien trabaja en el repo, agente o humano.

## Reglas de edición (aplican siempre, también en un fix suelto sin cambio abierto)

- **`data-cy` obligatorio**: todo elemento interactivo o localizable por un test lleva `data-cy="<contexto>-<tipo>-<accion>"` único, añadido en su propio `.element.ts` al crearlo. Nunca selectores de clase, ID o posición DOM en tests.
- **Nunca hardcodear** color, fuente, espaciado, sombra ni radio: siempre `var(--token)` de `src/shared/styles/tokens.css`. Modo oscuro obligatorio, hitbox mínima 56×56px.
- **Sin CSS inline** salvo animación o posicionamiento dinámico justificado. Los estilos van en el `*.element.css` del componente, que importa `tokens.css` (un Shadow DOM no hereda `index.css`).
- **Componentes compartidos** van en `src/shared/`, nunca duplicados entre dominios. Si dudas si algo es shared, pregunta antes de crearlo.
- **Extracción por límite de líneas**: si un `.element.ts` supera el límite de líneas del proyecto (`eslint.config.js`, `max-lines`), la lógica extraída puede vivir en un `.ts` suelto sin sufijo `.element`/`.transform` (p. ej. `route-detail-notes.ts`, `profile-header.ts`) — siempre con JSDoc explicando el porqué de la extracción. Excepción documentada al patrón de sufijos, no una convención nueva a seguir por defecto.
- **JSDoc conciso** (qué y por qué, no cómo) en todo símbolo exportado; el pre-commit lo verifica. Los `*.spec.ts` están exentos.
- **Nunca secretos** en código — van a variables de entorno o GitHub Secrets. Solo claves públicas pueden vivir en código.

## Autorización explícita

- No modificar `openspec/config.yaml`, este `CLAUDE.md`, `.clinerules/`, `.claude/commands/` ni `.claude/skills/` sin avisar antes — son la definición del propio workflow.
- No modificar `specs/` (histórico congelado) sin que el usuario lo pida.
- No commitear archivos generados o temporales, ni `.env` con valores reales.
- No mencionar a Claude ni a ningún asistente en mensajes de commit ni en PRs.

## Idioma

Documentación, specs y artefactos en español. Código en inglés (identificadores y comentarios). Commits consistentes dentro del mismo PR.
