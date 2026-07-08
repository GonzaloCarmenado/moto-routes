# Workflow SDD (Spec-Driven Development)

## Flujo de Trabajo Detallado

Este documento describe el proceso paso a paso para desarrollar cualquier feature usando SDD con DeepSeek + Cline.

## Resumen del Workflow

```
USER INPUT (requisito)
    │
    ▼
┌─────────────┐
│  SPEC-AGENT │──→ specs/features/<feature>.md
└─────────────┘
    │
    ▼
┌─────────────┐
│  PLAN-AGENT │──→ specs/features/<feature>.plan.md
└─────────────┘
    │
    ▼
┌──────────────┐
│  TASK-AGENT  │──→ GitHub Issues (gh CLI)
└──────────────┘
    │
    ▼
┌─────────────┐     ┌──────────────┐
│  IMPL-AGENT │────→│ tests/       │ (TDD: test first)
└─────────────┘     │ src/         │ (then impl)
    │               └──────────────┘
    ▼
┌───────────────┐
│  REVIEW-AGENT │──→ specs/features/<feature>.review.md
└───────────────┘
    │
    ▼
┌─────────────┐
│  TEST-AGENT │──→ Test results + coverage (100% pass, 80% code, 100% AC)
└─────────────┘
    │
    ▼
  [DONE] o [ITERATE]
```

## Fase 1: Especificación (SPEC)

**Objetivo**: Transformar un requisito de usuario en una especificación estructurada y no ambigua.

### Input
- Requisito en lenguaje natural del usuario
- Contexto del proyecto (memory/context.md)

### Proceso del Spec-Agent
1. **Análisis**: Lee el requisito y extrae:
   - Propósito del feature
   - Actores/usuarios involucrados
   - Comportamiento esperado
   - Edge cases identificables
2. **Refinamiento**: Hace preguntas al usuario si hay ambigüedades
3. **Estructuración**: Escribe la spec en formato estándar

### Output
Archivo `specs/features/<nombre-feature>.md` con estructura:

```markdown
# Feature: [Nombre]

## Descripción
[Qué hace, por qué existe]

## Criterios de Aceptación
- [ ] AC-001: [Criterio medible y verificable]
- [ ] AC-002: [Criterio medible y verificable]

## Comportamiento Esperado

### Escenario: [Nombre del escenario]
- **Dado** [precondición]
- **Cuando** [acción]
- **Entonces** [resultado esperado]

### Escenario: [Nombre del escenario]
- **Dado** [precondición]
- **Cuando** [acción]
- **Entonces** [resultado esperado]

## Constraints
- [Restricción técnica 1]
- [Restricción de negocio 1]

## Dependencias
- [Feature/sistema del que depende]

## Notas de Implementación
- [Detalles técnicos relevantes]
```

### Comando Cline para activar Spec-Agent
```
@agent:spec-agent Analiza el siguiente requisito y genera la especificación: [REQUISITO]
```

## Fase 2: Planificación (PLAN)

**Objetivo**: Descomponer la spec en un plan de implementación paso a paso.

### Input
- Spec del feature (`specs/features/<feature>.md`)

### Proceso del Plan-Agent
1. **Descomposición**: Divide la spec en tareas atómicas
2. **Secuenciación**: Ordena las tareas considerando dependencias
3. **Estimación**: Estima complejidad y tokens necesarios
4. **Diseño**: Propone arquitectura de la solución

### Output
Archivo `specs/features/<nombre-feature>.plan.md`:

```markdown
# Plan: [Nombre del Feature]

## Resumen de Tareas
| # | Tarea | Dependencias | Estimación |
|---|-------|--------------|------------|
| 1 | ...   | -            | Small      |
| 2 | ...   | T1           | Medium     |

## Paso 1: [Nombre de la tarea]
- **Archivos a crear/modificar**:
  - `src/...`
- **AC cubiertos**: AC-001, AC-002
- **Tests**: [qué tests escribir]

## Paso 2: [Nombre de la tarea]
...
```

### Comando Cline para activar Plan-Agent
```
@agent:plan-agent Basado en specs/features/<feature>.md, genera el plan de implementación
```

## Fase 3: Creación de Tareas (TASKS)

**Objetivo**: Transformar el plan de implementación en issues de GitHub para tracking real.

### Input
- Plan del feature (`specs/features/<feature>.plan.md`)

### Proceso del Task-Agent
1. **Lee el plan** y extrae cada paso como una tarea independiente
2. **Crea issues en GitHub** usando `gh issue create`:
   - Título: `[Feature] Paso N: descripción`
   - Body: Incluye AC cubiertos, archivos a modificar, tests a escribir
   - Labels: `feature`, `<nombre-feature>`, `spec-driven`
   - Milestone: Si existe un milestone para el feature
3. **Vincula issues** al plan (añade URLs de issues al plan.md)
4. **Confirma** que todos los pasos tienen su issue correspondiente

### Output
- Issues de GitHub creados y vinculados desde el plan
- Plan actualizado con referencias a los issues (`specs/features/<feature>.plan.md`)

### Comando Cline para activar Task-Agent
```
@agent:task-agent Crea issues de GitHub a partir de specs/features/<feature>.plan.md
```

### Requisitos Previos
- Tener `gh` CLI instalado y autenticado (`gh auth login`)
- Tener permisos para crear issues en el repositorio

## Fase 4: Implementación (IMPL)

**Objetivo**: Ejecutar el plan, paso a paso, escribiendo tests primero (TDD).

### Input
- Plan del feature
- Spec del feature

### Proceso del Impl-Agent
1. **Toma un paso del plan**
2. **Escribe tests** que validen los AC de ese paso
3. **Implementa el código** mínimo para pasar los tests
4. **Verifica**: Ejecuta tests, confirma que pasan
5. **Repite** hasta completar todos los pasos

### Principio TDD
```
RED (test fails) → GREEN (minimal code) → REFACTOR (clean code)
```

### Output
- Código fuente en `src/`
- Tests en `tests/`
- Updates al plan marcando tareas completadas

### Comando Cline para activar Impl-Agent
```
@agent:impl-agent Sigue el plan specs/features/<feature>.plan.md paso a paso usando TDD
```

## Fase 5: Revisión (REVIEW) — OBLIGATORIA tras IMPL

**Objetivo**: Verificar que la implementación cumple la spec original y no introduce riesgos de seguridad, inestabilidad o desviaciones en componentes compartidos.

### Input
- Spec original
- Código implementado
- Tests

### Proceso del Review-Agent
1. **Comparación**: Lee la spec y verifica cada AC contra el código
2. **Gap Analysis**: Identifica discrepancias entre spec y código
3. **Code Quality**: Revisa estándares, patrones, buenas prácticas
4. **Sección CRÍTICO**: Revisa seguridad, componentes compartidos, actualizaciones core, normas saltadas
5. **Genera reporte** con hallazgos

### Output
Archivo `specs/features/<nombre-feature>.review.md`:

```markdown
# Review: [Nombre del Feature]

## 📋 Ficheros Tocados
[Tabla con archivos, tipo de cambio, descripción]

## 📝 Resumen de Cambios
[Bullet points de lo implementado]

## ✅ Cumplimiento de AC
- [x] AC-001: Implementado en src/..., test en tests/...
- [ ] AC-002: NO IMPLEMENTADO - Gap encontrado

## 🔴 CRÍTICO
- Seguridad: [✅ Sin incidencias] o [❌ Hallazgo]
- Componentes comunes: [✅ Ninguno] o [⚠️ Archivos afectados]
- Actualizaciones core: [✅ Ninguna] o [⚠️ Cambios y justificación]
- Normas saltadas: [✅ Ninguna] o [⚠️ Regla, motivo y alternativa]

## ⚠️ Issues Encontrados
- **ISSUE-001**: [Descripción] → Recomendación: [acción]

## 📊 Veredicto
- [ ] APPROVED
- [ ] APPROVED WITH MINOR ISSUES
- [ ] CHANGES REQUESTED
- [ ] BLOCKED (seguridad o componente compartido crítico)
```

### ¿Cuándo se ejecuta?

**Automático**: El impl-agent, al completar todos los pasos del plan, recomienda ejecutar REVIEW. El workflow SDD no considera un feature como completado hasta que la fase REVIEW devuelve APPROVED.

**Manual**: El usuario puede invocar `@agent:review-agent Revisa <feature> contra specs/features/<feature>.md` en cualquier momento.

### Comando Cline para activar Review-Agent
```
@agent:review-agent Revisa la implementación de <feature> contra specs/features/<feature>.md
```

## Fase 6: Testing (TEST)

**Objetivo**: Validación final y generación de cobertura.

### Input
- Spec con criterios de aceptación
- Tests existentes
- Código implementado

### Proceso del Test-Agent
1. **Ejecuta todos los tests existentes**
2. **Analiza cobertura** (qué AC no están cubiertos)
3. **Genera tests faltantes** para cubrir gaps
4. **Ejecuta suite completa**, verifica que todo pasa
5. **Genera reporte** de cobertura

### Output
- Reporte de cobertura
- Tests adicionales (si necesario)

### Comando Cline para activar Test-Agent
```
@agent:test-agent Ejecuta y completa cobertura de tests para <feature>
```

## Ciclo de Iteración

Si el review o test encuentran issues:

```
[Issue encontrado] → [Actualizar spec si necesario] → [Re-implementar] → [Re-revisar]
```

**Regla de oro**: Si el código no coincide con la spec, O BIEN se arregla el código, O BIEN se actualiza la spec. Nunca divergen.

## Inicio de Sesión con Cline

Al iniciar una nueva sesión de Cline, usar este prompt para cargar el contexto:

```
Carga el contexto del proyecto desde memory/context.md. 
Estamos trabajando con SDD. 
El feature activo es: [NOMBRE]
La spec está en: specs/features/[NOMBRE].md
El plan está en: specs/features/[NOMBRE].plan.md
Estado actual: [PENDIENTE/EN_PROGRESO/REVIEW/TEST]
```

Esto minimiza el consumo de tokens al enfocar la atención solo en lo relevante.