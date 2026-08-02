# Gestión de Tokens para DeepSeek + Cline

## Por qué es Crítico

DeepSeek opera con ventanas de contexto limitadas y costes por token. Una mala gestión de tokens resulta en:
- **Pérdida de contexto**: La IA "olvida" partes importantes de la conversación
- **Mayor coste**: Más tokens = más consumo de API
- **Degradación de calidad**: Respuestas menos precisas con contextos saturados
- **Alucinaciones**: La IA inventa información que ya no está en contexto

## Modelos DeepSeek y sus Límites

| Modelo | Ventana de Contexto | Tokens de Output | Coste Aprox (input) |
|--------|---------------------|------------------|----------------------|
| DeepSeek-V3 | 128K tokens | 8K tokens | ~$0.27/1M tokens |
| DeepSeek-R1 | 128K tokens | 8K tokens | ~$0.55/1M tokens |
| DeepSeek-Coder | 128K tokens | 8K tokens | ~$0.27/1M tokens |

> **Nota**: Los precios son orientativos, verificar en la documentación oficial de DeepSeek.

## Estrategia de Gestión de Tokens en SDD

### Principio Fundamental: Contexto Mínimo Necesario

```
NO cargar todo el proyecto → SOLO cargar lo relevante para la tarea actual
```

### 1. Carga Progresiva de Contexto

En lugar de cargar toda la documentación al inicio, se sigue un modelo de carga por fases:

```
FASE 1 (Inicio de sesión):
  └── memory/context.md (~500 tokens)
      └── Solo metadata del proyecto: stack, estructura, estado actual

FASE 2 (Al abrir un cambio):
  └── openspec/changes/<cambio>/proposal.md + specs/ (~1000-2000 tokens)
      └── Solo los artefactos del cambio en el que se va a trabajar

FASE 3 (Al implementar una tarea):
  └── openspec/changes/<cambio>/tasks.md (tarea actual) (~500 tokens)
      └── Solo la tarea concreta, no todo el plan

FASE 4 (Al revisar):
  └── Spec + código a revisar (~2000-4000 tokens)
```

### 2. Presupuesto de Tokens por Fase

| Fase del SDD | Tokens Estimados | % Ventana (128K) |
|-------------|------------------|-------------------|
| Spec | 2,000 - 4,000 | 1.5% - 3% |
| Plan | 3,000 - 6,000 | 2.3% - 4.7% |
| Implement (por paso) | 4,000 - 10,000 | 3% - 7.8% |
| Review | 5,000 - 12,000 | 3.9% - 9.4% |
| Test | 3,000 - 8,000 | 2.3% - 6.3% |

**Regla de oro**: Mantener cada interacción por debajo del 15% de la ventana de contexto (~19K tokens) para dejar espacio a la respuesta del modelo y al historial de conversación.

### 3. Estrategias de Optimización

#### A. Documentos Atómicos
```
❌ MAL: Un spec de 5000 tokens con 20 criterios de aceptación
✅ BIEN: Dividir en specs más pequeñas (máx 1500 tokens cada una)
```

#### B. Referencias, No Duplicación
```markdown
❌ MAL: Copiar el contenido de context.md en cada spec
✅ BIEN: "Ver memory/context.md para stack y convenciones"
```

#### C. Carga Diferida (Lazy Loading)
```
No cargar:
- Agents que no se están usando
- Specs de otros features
- Historial completo de decisiones
- Código fuente no relacionado con la tarea

Sí cargar:
- Context.md (siempre)
- Spec del feature activo
- Paso actual del plan
- Archivos de código relevantes al paso
```

#### D. Compactación de Historial
Cuando la conversación con Cline se alarga, el historial consume tokens. Estrategias:

1. **Resumir al cambiar de fase**: Al pasar de spec a plan, pedir a Cline que resuma lo importante
2. **Iniciar nueva sesión**: Para fases distintas, usar sesiones nuevas con solo el contexto necesario
3. **Persistir en memoria**: Guardar decisiones y avances en `memory/decisions.md`

### 4. Tracking de Consumo de Tokens

El archivo `memory/tokens.md` lleva un registro del consumo:

```markdown
# Registro de Consumo de Tokens

## Resumen General
- **Total consumido (proyecto)**: XXX,XXX tokens
- **Total consumido (hoy)**: XX,XXX tokens
- **Features completados**: X
- **Media por feature**: XX,XXX tokens

## Registro por Sesión
| Fecha | Cambio | Operación | Tokens (est.) | Notas |
|-------|--------|-----------|---------------|-------|
| 2026-07-05 | auth | propose | 8,300 | proposal + specs + design + tasks |
| 2026-07-05 | auth | apply | 8,400 | Tareas 1 y 2 |
| 2026-07-05 | auth | archive | 4,100 | Gate de revisión |
```

### 5. Anti-Patrones que Desperdician Tokens

| Anti-Patrón | Problema | Solución |
|-------------|----------|----------|
| "Muéstrame todo el código" | Carga archivos innecesarios | Pedir solo archivos específicos |
| Specs enormes | Satura la ventana rápido | Dividir en sub-specs |
| Prompt verboso | Tokens gastados en instrucciones | System prompts concisos |
| No persistir decisiones | Repetir contexto en cada sesión | Escribir a memory/decisions.md |
| Implementar sin plan | Idas y venidas que alargan la conversación | Siempre planificar primero |
| No usar .clinerules | Perder tokens explicando reglas cada vez | Reglas fijas en .clinerules |

### 6. Cálculo Rápido de Tokens

Regla aproximada para estimar tokens:
- **1 token ≈ 4 caracteres en español**
- **1 token ≈ 0.75 palabras en español**
- **1 página de código ≈ 500-800 tokens**
- **1 spec bien escrita ≈ 1000-2000 tokens**

### 7. Ejemplo de Flujo Optimizado

```
Sesión 1 - SPEC:
  Prompt inicial: 150 tokens
  Context.md cargado: 500 tokens
  Requisito usuario: 200 tokens
  Spec generada: 1,200 tokens
  TOTAL sesión: ~2,050 tokens ✅

Sesión 2 - PLAN:
  Prompt inicial: 150 tokens
  Context.md cargado: 500 tokens
  Spec cargada: 1,200 tokens
  Plan generado: 2,500 tokens
  TOTAL sesión: ~4,350 tokens ✅

Sesión 3 - IMPL (Paso 1):
  Prompt inicial: 150 tokens
  Context.md cargado: 500 tokens
  Spec cargada: 1,200 tokens
  Plan (paso 1): 400 tokens
  Código generado: 1,000 tokens
  Tests generados: 800 tokens
  TOTAL sesión: ~4,050 tokens ✅
```

### 8. Configuración en Cline

En VSCode → Cline Settings, configurar:

```json
{
  "deepseek.model": "deepseek-chat",  // o deepseek-coder
  "deepseek.maxTokens": 8000,         // output máximo
  "deepseek.temperature": 0.3,        // más determinista para código
  "contextWindow.autoCompact": true,  // compactar automáticamente
  "contextWindow.compactThreshold": 0.7  // compactar al 70% de uso
}
```

### 9. Señales de Alerta

Si observas estos comportamientos, es probable que estés excediendo el presupuesto de tokens:

- La IA "olvida" instrucciones dadas al inicio de la sesión
- Respuestas genéricas en lugar de específicas al proyecto
- La IA pide información que ya se le proporcionó
- Código que no sigue las convenciones del proyecto (porque las "olvidó")
- Tiempos de respuesta más largos de lo normal

**Acción correctiva**: Cerrar sesión, resumir estado en `memory/`, iniciar nueva sesión con contexto fresco.