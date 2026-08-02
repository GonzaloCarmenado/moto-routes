# Sistema de Memoria para SDD con DeepSeek + Cline

## Concepto

El sistema de memoria es el mecanismo que permite a Cline + DeepSeek **recordar el contexto del proyecto entre sesiones**. Como cada sesión de chat es efímera (la ventana de contexto se reinicia), necesitamos persistir la información crítica en archivos que se puedan cargar al inicio de cada nueva sesión.

## Arquitectura de Memoria

```
memory/
├── context.md       ← Memoria de trabajo (carga obligatoria al inicio)
├── decisions.md     ← Registro de decisiones de arquitectura/diseño
├── tokens.md        ← Tracking de consumo de tokens
└── sessions/        ← Resúmenes de sesiones pasadas (opcional)
    └── 2026-07-05.md
```

## 1. Context.md — La Memoria Principal

### Propósito
Proporcionar a Cline/DeepSeek TODO lo que necesita saber sobre el proyecto en ~500 tokens. Es lo primero que se carga en cada sesión.

### Formato

```markdown
# Contexto del Proyecto: [Nombre]

## Identidad
- **Nombre**: [Nombre del proyecto]
- **Propósito**: [Una frase que define qué es y para quién]
- **Repositorio**: [URL si aplica]

## Stack Tecnológico
- **Lenguaje**: [Python 3.12 / TypeScript 5.x / ...]
- **Framework**: [FastAPI / Next.js / ...]
- **Base de datos**: [PostgreSQL / MongoDB / ...]
- **Testing**: [pytest / vitest / ...]
- **Infraestructura**: [Docker / Kubernetes / ...]

## Estructura del Proyecto
```
src/          # Código fuente
tests/        # Tests
openspec/     # Specs vivas y cambios (source of truth)
specs/        # Histórico congelado del SDD anterior
docs/         # Documentación de arquitectura
memory/       # Sistema de memoria
```

## Estado Actual del Proyecto
- **Fase**: [Inicial / En desarrollo / Producción]
- **Feature activo**: [Nombre del feature en desarrollo]
- **Último hito completado**: [Qué se terminó]
- **Próximo hito**: [Qué sigue]

## Convenciones
- **Estilo de código**: [PEP 8 / ESLint config / ...]
- **Commits**: [Conventional Commits / ...]
- **Ramas**: [GitFlow / trunk-based / ...]
- **Nombrado de archivos**: [kebab-case / snake_case / ...]

## Reglas para Cline/DeepSeek
- [Regla específica del proyecto 1]
- [Regla específica del proyecto 2]
```

### Ejemplo Real (cuando se defina el stack)

```markdown
# Contexto del Proyecto: MySaaS

## Identidad
- **Nombre**: MySaaS
- **Propósito**: Plataforma SaaS de gestión de inventario para PYMEs
- **Repositorio**: github.com/org/mysaas

## Stack Tecnológico
- **Lenguaje**: Python 3.12
- **Framework**: FastAPI
- **Base de datos**: PostgreSQL 16
- **Testing**: pytest + pytest-cov
- **Infraestructura**: Docker Compose (dev), Kubernetes (prod)

## Estructura del Proyecto
```
src/
├── api/          # Endpoints REST
├── models/       # Modelos de dominio
├── services/     # Lógica de negocio
└── db/           # Migraciones y repositorios
tests/
openspec/specs/
openspec/changes/
docs/
memory/
```

## Estado Actual del Proyecto
- **Fase**: Desarrollo inicial
- **Feature activo**: auth (autenticación de usuarios)
- **Último hito completado**: Setup del proyecto
- **Próximo hito**: Completar MVP de auth

## Convenciones
- **Estilo**: PEP 8, type hints obligatorios
- **Commits**: Conventional Commits
- **Ramas**: feature/<nombre> desde main
- **Nombrado**: snake_case para Python, kebab-case para archivos

## Reglas para Cline/DeepSeek
- Siempre usa type hints en Python
- Los endpoints van en src/api/, la lógica en src/services/
- Nunca commits directamente a main
- Cada PR debe referenciar una spec en specs/features/
```

## 2. Decisions.md — Architecture Decision Records (ADR)

### Propósito
Registrar decisiones técnicas importantes para que Cline no tenga que redescubrirlas en cada sesión.

### Formato

```markdown
# Registro de Decisiones

## ADR-001: [Título de la decisión]
- **Fecha**: 2026-07-05
- **Estado**: [Aceptada / Rechazada / En revisión]
- **Contexto**: [Qué problema resuelve]
- **Decisión**: [Qué se decidió]
- **Alternativas consideradas**: [Qué otras opciones se evaluaron]
- **Consecuencias**: [Qué impacto tiene]

## ADR-002: ...
```

### Ejemplo

```markdown
# Registro de Decisiones

## ADR-001: Usar PostgreSQL en lugar de MongoDB
- **Fecha**: 2026-07-05
- **Estado**: Aceptada
- **Contexto**: Necesitamos base de datos para el SaaS. Los datos son relacionales (usuarios, inventario, pedidos).
- **Decisión**: Usar PostgreSQL 16 con SQLAlchemy como ORM.
- **Alternativas consideradas**: MongoDB (descartada por falta de integridad referencial necesaria), MySQL (descartada por menor soporte de JSON).
- **Consecuencias**: Las migraciones se manejan con Alembic. Los modelos usan SQLAlchemy declarative base.

## ADR-002: Estrategia de branching
- **Fecha**: 2026-07-05
- **Estado**: Aceptada
- **Contexto**: Equipo pequeño (1-2 devs + IA).
- **Decisión**: Trunk-based development. Features en ramas cortas (<2 días). PR con review de spec.
- **Alternativas consideradas**: GitFlow (demasiado overhead para equipo pequeño).
- **Consecuencias**: main siempre deployable. PRs pequeños y frecuentes.
```

## 3. Tokens.md — Tracking de Consumo

### Propósito
Registrar el consumo de tokens por sesión para optimizar costes y detectar ineficiencias.

### Formato (definido en 04-token-management.md)

```markdown
# Registro de Consumo de Tokens

## Resumen General
- **Total consumido (proyecto)**: XXX,XXX tokens
- **Total consumido (hoy)**: XX,XXX tokens
- **Features completados**: X
- **Media por feature**: XX,XXX tokens

## Registro por Sesión
| Fecha | Feature | Fase | Agente | Tokens (est.) | Notas |
|-------|---------|------|--------|---------------|-------|
```

## 4. Sessions/ — Historial de Sesiones (Opcional)

Cuando una sesión es particularmente productiva o contiene información valiosa que no cabe en decisions.md:

```markdown
# Sesión: 2026-07-05

## Feature: auth
## Fase: Implementación (Pasos 1-2)

### Resumen
- Implementado endpoint POST /auth/login
- Implementado middleware de autenticación JWT
- Tests: 12 pasando, cobertura AC 100% para pasos 1-2

### Issues encontrados
- El middleware de FastAPI requiere manejo especial de excepciones → documentado en código

### Próximos pasos
- Paso 3: Endpoint POST /auth/register
```

## Flujo de Trabajo con Memoria

### Al Iniciar una Nueva Sesión

1. **Cline carga `memory/context.md`** automáticamente (configurado en .clinerules)
2. El usuario indica el feature activo: *"Trabajemos en el feature auth"*
3. Cline lee `specs/features/auth.md` y el plan correspondiente
4. Cline lee `memory/decisions.md` si hay decisiones relevantes al feature

### Durante la Sesión

- Si se toma una decisión de arquitectura → actualizar `memory/decisions.md`
- Si se completa un hito → actualizar `memory/context.md` (sección Estado Actual)
- Si se completa una fase → registrar en `memory/tokens.md`

### Al Finalizar una Sesión

1. Actualizar `memory/context.md` con el nuevo estado
2. Registrar tokens consumidos en `memory/tokens.md`
3. Si la sesión fue larga/compleja, guardar resumen en `memory/sessions/`

## Script de Inicio Rápido para Cline

Para minimizar el uso de tokens en el prompt inicial, usar este formato:

```
[Inicio de sesión SDD]

Contexto: @memory/context.md
Feature activo: [NOMBRE]
Fase actual: [SPEC|PLAN|IMPL|REVIEW|TEST]
Tarea concreta: [Descripción en una línea]

Carga solo los archivos necesarios para esta tarea.
```

Esto le da a Cline ~200 tokens de instrucción + 500 tokens de contexto = inicio eficiente.

## Mantenimiento de la Memoria

- **Context.md**: Actualizar al completar cada feature o hito importante
- **Decisions.md**: Actualizar tras cada decisión técnica significativa
- **Tokens.md**: Actualizar al final de cada sesión
- **Sessions/**: Solo para sesiones largas o con aprendizajes importantes

La memoria debe mantenerse **viva pero concisa**. Si un archivo crece demasiado (>2000 tokens), considerar dividirlo o resumir las partes antiguas.