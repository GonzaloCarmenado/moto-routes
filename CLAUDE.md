# CLAUDE.md — Moto Routes

## Regla fundamental

Este proyecto sigue **Spec-Driven Development con OpenSpec**. No se escribe código sin un cambio abierto en `openspec/changes/`. El ciclo es `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Si el código y los artefactos del cambio divergen, o se corrige el código o se actualiza el artefacto — nunca se dejan desalineados.

## Dónde vive la metodología

**`openspec/config.yaml` es el source of truth del proyecto**: stack, convenciones, diseño, seguridad, disciplina TDD y el gate de revisión. La CLI lo inyecta automáticamente al escribir artefactos y al ejecutar `apply`/`archive`, así que no lo repitas aquí ni lo copies a ningún artefacto. Este fichero solo recoge lo que aplica **fuera** de ese flujo.

Detalle navegable en `docs/` (`pnpm run docs`). Histórico del SDD anterior en `specs/` — congelado, ver `specs/README.md`.

## Flujo de Git

- **Toda spec nueva empieza en su propia rama**: antes de `/opsx:propose`, crear `feature/<nombre-del-cambio>` desde `master`. No se trabaja directamente en `master` — mismo patrón que exigía el SDD anterior (`Ramas: feature/<nombre> desde main`), que la migración a OpenSpec no debía haber relajado.
- **Todo cambio se cierra con un PR a `master`**, nunca con push directo — incluso después de un `/opsx:archive` con veredicto `APPROVED`/`APPROVED WITH MINOR ISSUES`. La descripción del PR referencia el `review.md` ya archivado en `openspec/changes/archive/<fecha>-<cambio>/`.
- Un fix puntual sin cambio OpenSpec abierto (bug urgente, ajuste menor) sigue el mismo patrón: rama + PR, nunca directo a `master`.
- **Esto es disciplina documentada, no un gate técnico**: ningún hook ni configuración de GitHub impide hoy saltárselo (decisión explícita — ver ADR correspondiente en `memory/decisions.md`). Es responsabilidad de quien commitea, agente o humano, cumplirlo igualmente.

## Memoria del proyecto (leer al empezar a trabajar aquí)

`memory/` es memoria **del proyecto**, no la memoria personal de Claude. Nadie te la carga automáticamente — léela tú:

- `memory/context.md` — estado actual y próximo hito. Cárgalo antes de tocar código. Incluye la lección aprendida del build de Android: léela antes de tocarlo, no la repitas de memoria.
- `memory/decisions.md` — ADRs. Consúltalo antes de revertir o cuestionar una decisión ya tomada; si tomas una nueva, añade el ADR aquí.
- `memory/sessions/` — resúmenes de sesiones largas.

## Reglas de edición (aplican siempre, también en un fix suelto sin cambio abierto)

- **`data-cy` obligatorio**: todo elemento interactivo o localizable por un test lleva `data-cy="<contexto>-<tipo>-<accion>"` único, añadido en su propio `.element.ts` al crearlo. Nunca selectores de clase, ID o posición DOM en tests.
- **Nunca hardcodear** color, fuente, espaciado, sombra ni radio: siempre `var(--token)` de `src/shared/styles/tokens.css`. Modo oscuro obligatorio, hitbox mínima 56×56px.
- **Sin CSS inline** salvo animación o posicionamiento dinámico justificado. Los estilos van en el `*.element.css` del componente, que importa `tokens.css` (un Shadow DOM no hereda `index.css`).
- **Componentes compartidos** van en `src/shared/`, nunca duplicados entre dominios. Si dudas si algo es shared, pregunta antes de crearlo.
- **JSDoc conciso** (qué y por qué, no cómo) en todo símbolo exportado; el pre-commit lo verifica. Los `*.spec.ts` están exentos.
- **Nunca secretos** en código — van a variables de entorno o GitHub Secrets. Solo claves públicas pueden vivir en código.

## Autorización explícita

- No modificar `openspec/config.yaml`, este `CLAUDE.md`, `.clinerules/`, `.claude/commands/` ni `.claude/skills/` sin avisar antes — son la definición del propio workflow.
- No modificar `specs/` (histórico congelado) sin que el usuario lo pida.
- No commitear archivos generados o temporales, ni `.env` con valores reales.
- No mencionar a Claude ni a ningún asistente en mensajes de commit ni en PRs.

## Idioma

Documentación, specs y artefactos en español. Código en inglés (identificadores y comentarios). Commits consistentes dentro del mismo PR.
