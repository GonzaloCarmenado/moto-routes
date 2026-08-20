# 03 · Metodología y calidad

## Spec-Driven Development sobre OpenSpec

El proyecto sigue **Spec-Driven Development** con la CLI **OpenSpec**. Regla fundamental: **no se
escribe código sin un cambio abierto en `openspec/changes/`**. El ciclo es:

1. **PROPOSE** (`/opsx:propose`) → escribe `proposal.md`, delta specs, `design.md` (con las ADR de
   las decisiones) y `tasks.md`.
2. **APPLY** (`/opsx:apply`) → implementa código + tests con **TDD estricto** (RED → GREEN →
   REFACTOR).
3. **ARCHIVE** (`/opsx:archive`) → gate de revisión obligatorio (veredicto), fusión de los deltas en
   `openspec/specs/`.

`openspec/config.yaml` es el **source of truth** del proyecto (stack, convenciones, diseño, seguridad,
disciplina TDD y gate de revisión). La CLI lo inyecta a los agentes al escribir artefactos y al
ejecutar apply/archive.

## Flujo de Git y Project

- Cada spec nueva empieza en una rama `feature/<nombre-del-cambio>` desde `master`.
- Todo cambio se cierra con **PR a `master`** (nunca push directo), incluso tras un archive
  `APPROVED`.
- Disciplina **documentada, no forzada técnicamente** (decisión ADR-029): no hay hook ni branch
  protection que lo impida; es responsabilidad de quien commitea.
- **GitHub Project** "Moto Routes" (org `crzverde`): una card por **cambio de OpenSpec**, con campo
  `Fase` (Backlog → Propuesto → En progreso → En revisión → Hecho).

## Quality gates (bloqueantes)

Definidos en `.husky/pre-commit` y replicados en CI:

| Gate | Herramienta | Criterio |
|------|-------------|----------|
| Auditoría dependencias (front) | `pnpm audit` | `--audit-level=high` |
| Auditoría dependencias (Rust) | `cargo audit` | con 2 excepciones documentadas (RUSTSEC-2023-0071, RUSTSEC-2026-0235) |
| Auditoría dependencias (Go) | `govulncheck` | 0 vulnerabilidades alcanzables |
| Lint frontend | ESLint 9 | `--max-warnings 0` (0 warnings, 0 errors) |
| Tests frontend | Vitest 3 | 100% pass + cobertura ≥ 80% (statements/functions/branches/lines) |
| Formato Rust | `cargo fmt --check` | sin cambios pendientes |
| Lint Rust | Clippy | `-D warnings` (0 warnings) |
| Tests Rust | `cargo test` | 100% pass |
| E2E | Cypress 15 | suite completa en verde (contra backend Docker real) |
| Build | tsc + vite + cargo + tauri + go build | sin errores |
| Cobertura docs | TypeDoc | umbral 70% (`scripts/docs-coverage.mjs`) |

## Estructura y convenciones de código (frontend)

- **Organización por dominio funcional**, no por tipo técnico: `src/cockpit/` (grabación),
  `src/routes/list/` + `src/routes/detail/`, `src/profile/`, `src/achievements/`, `src/auth/`,
  `src/shared/`.
- **Separación estricta por responsabilidad**: `.element.ts` (componente) + `.element.css` (estilos)
  + `.service.ts` (efectos/IO) + `.transform.ts` (lógica pura) + `.types.ts` (tipos). Cada `x.ts`
  con su `x.spec.ts` al lado.
- **Lo compartido va a `src/shared/`** y nunca se duplica entre dominios.
- **`data-cy` obligatorio** en todo elemento interactivo (`<contexto>-<tipo>-<accion>` único), nunca
  selectores de clase/ID/posición DOM en tests.
- **Diseño "Asfalto Nocturno"**: modo oscuro obligatorio, tokens CSS en
  `src/shared/styles/tokens.css` (nunca hardcodear color/fuente/espaciado/sombra/radio), hitbox
  mínima 56×56 px, contraste WCAG AA, respeto de `prefers-reduced-motion`.
- **Sin CSS inline** salvo animación/posicionamiento dinámico justificado.
- **JSDoc conciso** en todo símbolo exportado (verificado por `eslint-plugin-jsdoc`).
- **Dependencias mínimas**: se prefiere API nativa antes que añadir un paquete.

## Testing

| Capa | Herramienta | Notas |
|------|-------------|-------|
| Unitarios frontend | Vitest 3 + jsdom | cobertura v8, umbral 80% |
| E2E | Cypress 15 | levanta Vite en :1420 y el backend real en Docker |
| Unit + integración Rust | `cargo test` | |
| Unit + integración Go | `go test ./...` | integración real contra Postgres, aislada por schema (`internal/dbtest`) |

## Memoria del proyecto

- `memory/context.md` — estado actual y próximo hito (cargar antes de tocar código).
- `memory/decisions.md` — **ADR** (ADR-013 a ADR-049+), decisiones arquitectónicas inmutables.
- `memory/sessions/` — resúmenes de sesiones largas.
- `memory/tokens.md` — registro de eficiencia de tokens.
- `memory/metrics/events.jsonl` — log de fallos del SDLC (categorías: `memory-miss`,
  `gate-bypass`, `scope-violation`, `spec-drift`, `rework`, `other`).

## Seguridad (resumen)

- **Nunca secretos en código**: todo secreto de backend (credenciales Postgres, clave JWT, API keys,
  cuenta de servicio FCM) vive en variables de entorno / GitHub Secrets, nunca en ficheros
  versionados.
- **Contraseñas hasheadas** con bcrypt (nunca hash propio); tokens de sesión firmados con JWT (nunca
  firma hecha a mano).
- **Anti-enumeración de cuentas**: registro/login/reset responden igual exista o no la cuenta.
- **Rate limiting** en todos los endpoints de auth y en compartir ruta.
- **CSP estricta** en Tauri (sin `unsafe-eval`/`unsafe-inline` de script).
- **Capabilities Tauri** con permisos mínimos (ver 06).
- **Fotos cifradas** con AES-256 antes de subir a MinIO.
- Detalle completo en `docs/06-seguridad.md` y `docs/informe-tecnico-seguridad.md`.

## Documentación generada

- **VitePress** (docs del proyecto) + **TypeDoc** (API TS) + **cargo doc** (Rust), orquestado por
  `pnpm docs`.
