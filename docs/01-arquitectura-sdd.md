# Arquitectura SDD (Spec-Driven Development)

## Visión General

Esta plantilla implementa un flujo de trabajo **Spec-Driven Development** optimizado para **DeepSeek + Cline**. 
El principio fundamental es: **las especificaciones son el source of truth**, y todo el código se deriva de ellas.

## Filosofía

```
SPECS (qué construir) → AGENTES (cómo construirlo) → CÓDIGO (implementación) → VERIFICACIÓN (contra specs)
```

No se escribe código sin una spec que lo respalde. No se modifica una spec sin actualizar el código.

## Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────┐
│                    CAPA DE ESPECIFICACIONES              │
│  specs/                                                  │
│  ├── features/     (specs funcionales por feature)       │
│  ├── api/          (contratos de API)                    │
│  ├── data/         (modelos de datos, schemas)           │
│  └── ui/           (especificaciones de interfaz)        │
├─────────────────────────────────────────────────────────┤
│                    CAPA DE AGENTES                       │
│  agents/                                                 │
│  ├── init-agent    (inicializa proyecto con templates)   │
│  ├── spec-agent    (analiza y refina specs)              │
│  ├── plan-agent    (genera plan de implementación)       │
│  ├── task-agent    (crea issues y PRs con gh CLI)        │
│  ├── impl-agent    (ejecuta la implementación con TDD)   │
│  ├── review-agent  (revisa contra specs con CRÍTICO)     │
│  └── test-agent    (valida cobertura y quality gates)    │
├─────────────────────────────────────────────────────────┤
│                    CAPA DE IMPLEMENTACIÓN                │
│  src/             (código fuente)                        │
│  tests/           (tests automatizados)                  │
├─────────────────────────────────────────────────────────┤
│                    CAPA DE MEMORIA                       │
│  memory/                                                │
│  ├── context.md    (contexto persistente del proyecto)   │
│  ├── decisions.md  (registro de decisiones)              │
│  └── tokens.md     (tracking de consumo)                 │
└─────────────────────────────────────────────────────────┘
```

## Principios Clave

### 1. Spec-First
Todo desarrollo comienza con una especificación. Las specs son documentos estructurados que definen:
- **Qué** se debe construir
- **Por qué** se debe construir
- **Criterios de aceptación** claros y medibles
- **Constraints** técnicos y de negocio

### 2. Agent-Driven
Cada fase del desarrollo es ejecutada por un agente especializado. Los agentes son "skills" que Cline/DeepSeek consumen como instrucciones de comportamiento.

### 3. Token-Aware
DeepSeek tiene ventanas de contexto limitadas. Cada interacción debe ser consciente del consumo de tokens. Ver [04-token-management.md](04-token-management.md).

### 4. Memory-Persistente
El contexto crítico se persiste en archivos markdown que Cline puede leer al iniciar una sesión. Ver [05-memory-system.md](05-memory-system.md).

## Ciclo de Vida SDD

```
[Spec] → [Plan] → [Tasks] → [Implement] → [Review] → [Test]
  ↑        ↑         ↑           ↑            ↑          ↑
  └────────┴─────────┴───────────┴────────────┴─── feedback loop ──┘
```

1. **Spec**: El spec-agent analiza requisitos y genera/escribe la especificación
2. **Plan**: El plan-agent genera un plan de implementación paso a paso
3. **Tasks**: El task-agent crea issues de GitHub con `gh` a partir del plan
4. **Implement**: El impl-agent ejecuta cada paso del plan con TDD
5. **Review**: El review-agent verifica que la implementación cumple la spec
6. **Test**: El test-agent valida cobertura (100% AC, 80% code, 100% pass rate)

## Stack Tecnológico (Agonóstico)

Esta plantilla es independiente del lenguaje/framework. La infraestructura SDD se adapta a:
- Backend: Node.js, Python, Go, Java, etc.
- Frontend: React, Vue, Angular, etc.
- Mobile: React Native, Flutter, etc.
- Infra: Docker, Kubernetes, Terraform, etc.

Los agentes y specs no dependen del lenguaje. Solo la capa de implementación.

## Métricas de Éxito

- **Cobertura de spec**: % de código que tiene una spec asociada (target: 100%)
- **Fidelidad de implementación**: % de criterios de aceptación cumplidos (target: 100%)
- **Eficiencia de tokens**: tokens consumidos por feature implementada
- **Tiempo de ciclo**: tiempo desde spec hasta deploy verificado