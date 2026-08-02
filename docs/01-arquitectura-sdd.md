# Arquitectura SDD (Spec-Driven Development)

## Visión General

Moto Routes practica **Spec-Driven Development** sobre [OpenSpec](https://github.com/Fission-AI/OpenSpec). El principio fundamental no cambia: **las especificaciones son el source of truth** y todo el código se deriva de ellas. Lo que cambió en agosto de 2026 es la maquinaria — de un SDD propio de seis fases y siete agentes a un framework mantenido por una comunidad. El porqué está en el ADR-027 (`memory/decisions.md`).

No se escribe código sin un cambio abierto que lo respalde. Si el código y la spec divergen, o se corrige el código o se actualiza la spec.

## Arquitectura de Capas

```
┌──────────────────────────────────────────────────────────────┐
│                    CAPA DE CONFIGURACIÓN                     │
│  openspec/config.yaml        ← source of truth del proyecto  │
│  ├── context:                (stack, convenciones, diseño)   │
│  ├── rules:                  (por artefacto)                 │
│  └── operations:             (apply / archive)               │
│                                                              │
│  CLAUDE.md · .clinerules/    ← solo lo que aplica fuera      │
│                                 del flujo de artefactos      │
├──────────────────────────────────────────────────────────────┤
│                    CAPA DE ESPECIFICACIONES                  │
│  openspec/                                                   │
│  ├── specs/       (verdad actual: qué hace el sistema hoy)   │
│  └── changes/     (propuestas en curso, con delta specs)     │
│      └── <cambio>/                                           │
│          ├── proposal.md   (qué y por qué)                   │
│          ├── specs/        (delta: ADDED/MODIFIED/REMOVED)   │
│          ├── design.md     (cómo)                            │
│          ├── tasks.md      (pasos, checkboxes)               │
│          └── review.md     (veredicto del gate de cierre)    │
├──────────────────────────────────────────────────────────────┤
│                    CAPA DE IMPLEMENTACIÓN                    │
│  src/             (frontend TypeScript + Web Components)     │
│  src-tauri/       (backend Rust + Tauri 2)                   │
│  cypress/         (tests E2E)                                │
├──────────────────────────────────────────────────────────────┤
│                    CAPA DE MEMORIA                           │
│  memory/                                                     │
│  ├── context.md   (estado actual, próximo hito)              │
│  ├── decisions.md (ADRs)                                     │
│  ├── tokens.md    (bitácora de sesiones)                     │
│  └── sessions/    (resúmenes de sesiones largas)             │
├──────────────────────────────────────────────────────────────┤
│                    HISTÓRICO (CONGELADO)                     │
│  specs/features/  (10 features cerradas del SDD anterior)    │
│  specs/ui/        (design-system, frontend-conventions)      │
└──────────────────────────────────────────────────────────────┘
```

## Principios Clave

### 1. Spec-first, delta-first

Todo desarrollo empieza con un cambio. Pero a diferencia del SDD anterior, **no se documenta el codebase entero**: se escriben specs solo de lo que se va a cambiar. Un cambio contiene *delta specs* (`ADDED` / `MODIFIED` / `REMOVED`) que describen la diferencia, no el estado completo. Al archivar el cambio, esos deltas se funden en `openspec/specs/`, que va creciendo como retrato vivo de lo que el sistema hace.

Es lo que hace viable adoptar SDD en un proyecto ya en marcha: no hay que migrar diez features cerradas para empezar.

### 2. Configuración única y agnóstica

`openspec/config.yaml` es el único sitio donde vive la metodología. La CLI lo inyecta al escribir cualquier artefacto y al ejecutar `apply`/`archive`, de modo que **Cline+DeepSeek y Claude Code reciben exactamente las mismas instrucciones** sin mantener dos copias. Ver [03-configuracion-openspec.md](03-configuracion-openspec.md).

### 3. Token-aware

DeepSeek tiene una ventana de 128K y el flujo debe caber en ella. OpenSpec fue elegido en parte por ser el más ligero de los frameworks evaluados. Ver [04-token-management.md](04-token-management.md).

### 4. Memoria persistente

`memory/` sobrevive a la migración: OpenSpec gestiona *cambios*, no el estado acumulado del proyecto ni sus decisiones de arquitectura. Ver [05-memory-system.md](05-memory-system.md).

### 5. Gates propios por encima del framework

OpenSpec no trae gates de revisión ni de cobertura. Los del proyecto se conservan, reubicados en `operations.apply.guidance` (TDD estricto, quality gates) y `operations.archive.guidance` (revisión con sección CRÍTICO y veredicto). El único gate con ejecución real sigue siendo el pre-commit de Husky, que es independiente de la herramienta.

## Ciclo de Vida

```
   /opsx:propose          /opsx:apply           /opsx:archive
        │                      │                      │
        ▼                      ▼                      ▼
  ┌───────────┐          ┌───────────┐          ┌───────────┐
  │  PROPOSE  │─────────▶│   APPLY   │─────────▶│  ARCHIVE  │
  └───────────┘          └───────────┘          └───────────┘
   proposal.md            código + tests         gate de revisión
   specs/ (delta)         checkboxes en          review.md + veredicto
   design.md              tasks.md               deltas → openspec/specs/
   tasks.md               TDD estricto           cambio → archivo
        │                                              │
        └──────── /opsx:explore en cualquier momento ──┘
```

`/opsx:explore` no es una fase: es un modo de pensar que se puede usar antes, durante o entre cualquiera de las tres.

## Métricas de Éxito

- **Fidelidad**: % de escenarios de la spec con un test que los valida (objetivo: 100%).
- **Cobertura de líneas**: ≥80% en Vitest (lines, functions, branches, statements).
- **Pass rate**: 100% en Vitest y `cargo test`.
- **Veredicto**: ningún cambio se archiva sin `APPROVED` o `APPROVED WITH MINOR ISSUES`.
