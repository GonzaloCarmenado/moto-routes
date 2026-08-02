# Revisión: migrar-sdd-a-openspec

Gate de cierre según `operations.archive.guidance`. Fecha: 2026-08-02.

## 🔴 CRÍTICO

### Seguridad
✅ **Sin incidencias.** El cambio no toca `src/`, `src-tauri/` ni `cypress/`. Barrido del diff completo en busca de credenciales (`api_key`, `secret`, `token`, `password`, `bearer`, `private_key`, connection strings): las únicas coincidencias son prosa del design system ("tokens" de `tokens.css`) y de la gestión de contexto ("tokens" de LLM). Sin cambios en CSP, `capabilities/` ni validación de inputs.

### Componentes compartidos afectados
✅ **Ninguno.** `git status --porcelain src/ src-tauri/ cypress/` no devuelve nada. `src/shared/` intacto.

### Actualizaciones core
✅ **Ninguna.** `package.json`, `pnpm-lock.yaml`, `Cargo.toml` y `Cargo.lock` sin modificar. Ninguna dependencia añadida ni eliminada.

### Normas del proyecto saltadas
⚠️ **Una, con autorización previa.** `CLAUDE.md` y `.clinerules/` están protegidos por la regla de gobernanza que exige avisar antes de modificarlos. Se modificaron porque son el objeto explícito de este cambio, aprobado por el usuario en el `proposal.md` y ejecutado con `/opsx:apply`. No es un salto silencioso.

⚠️ **La guía 3 de `archive.guidance` no aplica.** Exige mapear cada `Requirement` y `Scenario` del delta spec contra su test. Este cambio declara `skip_specs: true` y no tiene delta specs porque no introduce comportamiento observable. En su lugar se verificó lo contrario: que efectivamente **no** se introdujo comportamiento (ver Verificación).

## 📋 Ficheros tocados

| Fichero | Tipo | Cambio |
|---|---|---|
| `openspec/config.yaml` | MODIFICADO | +10 reglas rescatadas de los agentes; `rules` 18→19, `guidance` 13→19 |
| `CLAUDE.md` | MODIFICADO | 98 → 39 líneas |
| `.clinerules/00-project-rules.md` | MODIFICADO | 90 → 43 líneas |
| `.claude/agents/*.md` (7) | BORRADO | spec, plan, task, impl, review, test, init |
| `.claude/commands/sdd-*.md` (7) | BORRADO | comandos del flujo antiguo |
| `docs/01-arquitectura-sdd.md` | REESCRITO | Capas con `openspec/`, ciclo propose→apply→archive |
| `docs/02-workflow-sdd.md` | REESCRITO | Tres fases, delta specs, gate de cierre |
| `docs/03-agentes-skills.md` | BORRADO | Sustituido |
| `docs/03-configuracion-openspec.md` | CREADO | `config.yaml` + tabla de destino de cada agente |
| `docs/04-token-management.md` | MODIFICADO | Fases de carga y tabla de registro |
| `docs/05-memory-system.md` | MODIFICADO | Dos árboles de directorios |
| `docs/index.md` | MODIFICADO | Descripción del flujo |
| `docs/.vitepress/config.mjs` | MODIFICADO | Sidebar |
| `README.md` | MODIFICADO | Árbol, metodología, tabla de docs |
| `specs/README.md` | CREADO | Aviso de congelación |
| `memory/decisions.md` | MODIFICADO | Nota de actualización de ADR-027 |
| `memory/context.md` | MODIFICADO | Estado resultante |
| `openspec/changes/migrar-sdd-a-openspec/` | CREADO | proposal, design, tasks, notas, este review |

Total: 34 ficheros, +903 / −1493.

## ✅ Cobertura de tareas

26/26 tareas de `tasks.md` completadas (la 7.3 es este documento).

Sin delta specs que mapear (`skip_specs: true`). En su lugar, cada afirmación estructural del `proposal.md` se verificó de forma ejecutable:

| Afirmación | Comprobación | Resultado |
|---|---|---|
| 7 subagentes eliminados | `ls .claude/agents` | Directorio vacío ✓ |
| 7 comandos `sdd-*` eliminados | `ls .claude/commands` | Solo `opsx/` ✓ |
| Tooling OpenSpec intacto | `find` sobre los 4 directorios | 6 ficheros cada uno ✓ |
| Cero referencias muertas a `agents/` | `grep -rn "agents/" CLAUDE.md .clinerules/ docs/ README.md` | 1 coincidencia, intencionada (ver ISSUE-001) |
| `CLAUDE.md` ≡ `.clinerules/00-project-rules.md` | `diff` de encabezados y reglas | Única diferencia: sección `## Tokens` ✓ (documentada) |
| Enlaces internos de docs resuelven | Resolución de cada `](*.md)` | 5/5 ✓ |
| Sidebar de VitePress resuelve | Resolución de cada `link:` | 7/7 ✓ |
| `config.yaml` inyectado por la CLI | `openspec instructions proposal --json` | `context` 3.036 chars, `rules` 5 ✓ |
| Sin comportamiento nuevo | `git status --porcelain src/ src-tauri/ cypress/` | Vacío ✓ |

## 🧪 Verificación independiente

Re-ejecutada por el revisor, no aceptada del resumen de implementación:

| Gate | Resultado |
|---|---|
| Vitest | **719/719** en 74 ficheros |
| Cobertura de líneas | 96.15% (umbral 80%) |
| ESLint | 0 warnings |
| `tsc --noEmit` | Sin errores |
| `cargo fmt --check` | OK |
| `cargo clippy -- -D warnings` | 0 warnings, 0 errores |
| `cargo test` | 5/5 |
| `pnpm run docs` | Build correcto |
| Cobertura de documentación | 72% (306/423), umbral 70% |
| `openspec validate --all` | 1 passed, 0 failed |
| `openspec doctor` | Root ok |

Cypress no se ejecutó: el cambio no toca UI. Coherente con la guía de `apply`, que solo lo exige si hay cambios de interfaz.

## ⚠️ Hallazgos

### ISSUE-001 — El grep de la tarea 6.1 no queda literalmente vacío
- **Severidad**: BAJA
- **Categoría**: desviación (menor, respecto al criterio literal de la tarea)
- **Ubicación**: `docs/03-configuracion-openspec.md:72`
- **Descripción**: la tarea 6.1 pedía que `grep -rn "agents/"` sobre `CLAUDE.md`, `.clinerules/` y `docs/` no devolviera resultados. Devuelve uno: *"Hasta agosto de 2026 el proyecto tenía siete subagentes en `agents/` y `.claude/agents/`. Todos se eliminaron"*.
- **Análisis**: no es una referencia muerta sino la frase que documenta la migración, dentro de la tabla que explica dónde aterrizó cada agente. Reescribirla para satisfacer el grep empeoraría la documentación.
- **Recomendación**: aceptar. Sin acción.

### ISSUE-002 — `README.md` no estaba en el alcance declarado
- **Severidad**: BAJA
- **Categoría**: desviación
- **Ubicación**: `README.md` (árbol de directorios, sección Metodología, tabla de documentación)
- **Descripción**: el `proposal.md` enumeró los ficheros a tocar y `README.md` no figuraba. Al borrar `docs/03-agentes-skills.md` se descubrió que lo referenciaba, además de contener un árbol con `agents/` y la tabla de las 6 fases del flujo antiguo.
- **Análisis**: era una referencia muerta **creada por este mismo cambio**. Dejarla habría contradicho el objetivo declarado ("cero referencias muertas"). Se corrigió y se reportó en el momento, no en silencio — conforme a la guía de `apply` sobre gaps.
- **Recomendación**: aceptar. El alcance real fue ligeramente mayor que el declarado, en la dirección correcta.

### ISSUE-003 — `CLAUDE.md` quedó en 39 líneas, no en las ~30 estimadas
- **Severidad**: BAJA
- **Categoría**: desviación
- **Ubicación**: `CLAUDE.md`
- **Descripción**: `proposal.md` y `tasks.md` estimaban ~30 líneas; el resultado son 39 (y 43 en `.clinerules`).
- **Análisis**: estimación previa a redactarlo, no un requisito. La reducción real es del 60%, y el `design.md` ya advertía de que el residuo es irreducible por el momento de inyección de `config.yaml`.
- **Recomendación**: aceptar.

### Observación — ADR-027 conserva su texto original
Las Consecuencias de ADR-027 siguen diciendo que los agentes se *realinean* en vez de eliminarse, lo que contradice lo ejecutado. **Es intencionado**: una ADR no se reescribe retroactivamente. La desviación está documentada como nota de actualización fechada al final de la propia ADR, con racional y vuelta atrás. Sin acción.

## Riesgos vivos tras el cierre

Ninguno bloqueante, pero conviene tenerlos presentes:

1. **Pérdida de revisión en contexto fresco.** Documentada como trade-off asumido en `design.md` (Decisión 2). Esta revisión es, de hecho, el primer caso: la ha ejecutado el mismo contexto que implementó. Se ha mitigado re-ejecutando toda la suite y comprobando cada afirmación del proposal con un comando, en vez de darla por buena. Reevaluar tras dos o tres cierres.
2. **Divergencia futura entre `CLAUDE.md` y `.clinerules/00-project-rules.md`.** Hoy coinciden salvo la sección `## Tokens`. No hay mecanismo que lo verifique automáticamente.
3. **Issues de GitHub huérfanas** (#66-#80, #53): al eliminar `task-agent` dejan de tener flujo que las cierre. Limpieza pendiente, fuera de este cambio.

## 📊 Veredicto

**APPROVED WITH MINOR ISSUES**

Las 26 tareas están completas y verificadas de forma independiente. Los tres hallazgos son de severidad baja y ninguno requiere acción: dos son desviaciones de alcance en la dirección correcta y el tercero es una estimación superada. Sin problemas de seguridad, sin cambios en componentes compartidos, sin dependencias nuevas y sin una sola línea de código de producto modificada.
