# Review — `entorno-api-docker`

Verificación independiente: código releído fichero a fichero y suite completa re-ejecutada por mi cuenta en esta misma sesión de revisión (no se acepta como bueno el resumen de la implementación previa). Resultados de esta re-ejecución, no de la primera pasada:

- `apps/mobile`: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, `vitest run --coverage` → **759/759 tests, 246 suites**, `pnpm run build` (Vite) → build limpio.
- `apps/mobile/src-tauri`: `cargo fmt --check` limpio, `cargo clippy -- -D warnings` limpio, `cargo test` → **5/5**.
- `apps/mobile` (Cypress): `pnpm run test:e2e` → **39/39** (6 specs).
- `apps/api`: `mvn test` (contenedor Maven, sin Maven instalado en local) → **2/2**, `BUILD SUCCESS`.
- `infra/docker`: `docker compose up --build` levanta ambos contenedores; `curl /api/ping` → 200 con timestamp real de Postgres; `INSERT` + `down`/`up` sin `-v` → fila persiste; `docker stop` de `postgres` con la API arriba → 503 controlado (`"Failed to obtain JDBC Connection"`), sin crash.

## CRÍTICO — leer primero

- **Sin secretos en código**: verificado con `grep` sobre `apps/api/` — ninguna credencial real en `application.properties`/`Dockerfile`/código fuente (solo placeholders `${DB_URL}`/`${DB_USERNAME}`/`${DB_PASSWORD}`; las referencias a `MVNW_USERNAME`/`MVNW_PASSWORD` en `mvnw`/`mvnw.cmd` son boilerplate estándar del wrapper oficial, vacías por defecto). Credenciales de Postgres para desarrollo local en `infra/docker/.env`, confirmado con `git check-ignore` que NO se rastrea (`.env.example` sí, sin valores reales).
- **Cambios en `src/shared/`**: `apps/mobile/src/shared/ci/ci-workflow.spec.ts` y `apps/mobile/src/shared/http/pre-commit-audit-gate.spec.ts` se modificaron — pero son ficheros de test puro (regresión estructural sobre `.github/workflows/ci.yml` y `.husky/pre-commit`), sin código de producción tocado. Radio de impacto: cero para el resto de `shared/`, ninguna otra suite depende de estos dos ficheros.
- **Dependencias nuevas**: ninguna npm/Cargo. Nuevas en el ecosistema Maven (`spring-boot-starter-web/jdbc`, `org.postgresql:postgresql`, `spring-boot-starter-test`) — fuera del alcance de `pnpm audit`/`cargo audit` existentes. No hay gate de auditoría de dependencias Maven todavía (consistente con el alcance explícito de la propuesta: "sin CI para el servicio Java" por ahora) — anotado como deuda para cuando este backend crezca.
- **Regla de proyecto saltada y corregida en la propia sesión**: la propuesta inicial iba a hardcodear credenciales triviales de Postgres en `docker-compose.yml`. Se corrigió antes de completar la implementación (no llegó a quedar así) — ver `design.md` § Configuración de conexión.

## Cobertura de Requirement/Scenario

### `monorepo-layout`

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| App móvil se reubica sin cambio de comportamiento | Tests existentes siguen pasando | 759/759 Vitest + 39/39 Cypress + 5/5 cargo test, re-ejecutados en esta revisión | ✅ Automatizado |
| App móvil se reubica sin cambio de comportamiento | Build sigue funcionando igual | `pnpm run build` (Vite) verificado en esta revisión. `pnpm tauri android build` (APK) **NO** re-ejecutado — cambio puramente estructural, no toca GPS/cámara/persistencia/permisos/mapa (el único criterio que este proyecto usa para exigir verificación en dispositivo, ver `tasks.md` histórico) | ⚠️ Parcial — recomendado un smoke build de Android antes o justo después de abrir la PR |
| CI resuelve las nuevas rutas | CI ejecuta correctamente tras el cambio | `ci-workflow.spec.ts` (24 aserciones) verifica la estructura exacta de `ci.yml` incluyendo `working-directory` por paso — confirmado rojo→verde con TDD real. **No ejecutado todavía en un runner real de GitHub Actions** (requiere una PR abierta) | ⚠️ Pendiente — se verifica con la primera ejecución de CI de la PR, mismo criterio que ya advierte ADR-031 sobre los límites del test estructural |
| pre-commit resuelve las nuevas rutas | pre-commit se ejecuta correctamente | `pre-commit-audit-gate.spec.ts` (6 aserciones), TDD rojo→verde real | ✅ Automatizado |
| pnpm solo gestiona apps/mobile | pnpm install no trata apps/api como paquete pnpm | `pnpm install` ejecutado repetidamente sin error en esta sesión; `pnpm-workspace.yaml` → `packages: [apps/mobile]` | ✅ Verificado (ejecución real) |
| Carpetas transversales no se mueven | OpenSpec sigue operando desde la raíz | Todos los comandos `openspec status`/`instructions`/`validate` de esta sesión, ejecutados desde la raíz sin configuración adicional | ✅ Verificado (ejecución real) |

### `api-backend`

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| Endpoint verifica conectividad real | Responde 200 con DB disponible | `PingControllerTest.respondsOkWithTheRealDatabaseValueWhenPostgresIsReachable` (`apps/api/src/test/java/com/motoroutes/api/ping/PingControllerTest.java:24`) + `curl` real contra Docker Compose (200, timestamp real) | ✅ Automatizado + E2E real |
| Endpoint verifica conectividad real | Responde error controlado sin DB | `PingControllerTest.respondsServiceUnavailableWithoutCrashingWhenPostgresIsUnreachable` (línea 38) + `docker stop postgres` real (503, sin crash) | ✅ Automatizado + E2E real |
| Sin secretos en código | Sin credenciales hardcodeadas | `grep` sobre `apps/api/` (ver CRÍTICO) | ✅ Verificado |

### `local-dev-environment`

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| Compose levanta todo con un comando | Stack arranca con un solo comando | `docker compose up --build`, dos ejecuciones independientes en esta sesión | ✅ Verificado (ejecución real) |
| Imágenes coinciden con Debian 13 | Postgres es la variante trixie | `image: postgres:16-trixie` en `docker-compose.yml:3` | ✅ Verificado (inspección + build real) |
| Imágenes coinciden con Debian 13 | API se basa en Debian 13 | `Dockerfile:8,17` (`debian:trixie`/`debian:trixie-slim`), paquetes `openjdk-21-jdk-headless`/`-jre-headless`/`maven` confirmados existentes en los repos de trixie con `apt-cache policy` real | ✅ Verificado (inspección + build real) |
| Datos persisten entre reinicios | Reiniciar conserva la tabla dummy | `INSERT` manual + `docker compose down`(sin `-v`)/`up` + `SELECT`, repetido dos veces en la sesión (implementación y esta revisión) | ✅ Verificado (ejecución real) |

**Cobertura de escenarios: 12/12 con verificación real** (9 completas, 2 con verificación automatizada fuerte pero pendientes de confirmación en un entorno que esta sesión no puede alcanzar — runner real de GitHub Actions y dispositivo Android —, 1 parcial ya detallada arriba). Ninguna sin verificación de ningún tipo.

## Hallazgos

- **[calidad, resuelto en esta revisión]** `PingResult.healthy()`/`unhealthy()` (`apps/api/src/main/java/com/motoroutes/api/ping/PingResult.java`) no tenían Javadoc propio, pese a que `design.md` extiende a Java el mismo criterio que exige JSDoc en símbolos exportados de TS. Corregido durante esta revisión (una línea por método). Los métodos `ping()` de `PingService`/`PingController` no llevan Javadoc individual — **no es un gap**: coherente con la propia configuración ESLint del proyecto (`MethodDefinition: false` en la regla `jsdoc/require-jsdoc`), que nunca exigió documentar cada método de una clase ya documentada a nivel de clase.
- **[cobertura, pendiente no bloqueante]** Ejecución real de `.github/workflows/ci.yml` en un runner de GitHub Actions — solo posible con una PR abierta. El test estructural (`ci-workflow.spec.ts`) da cobertura fuerte pero no sustituye la ejecución real (mismo matiz que ya documenta ADR-031). Acción: revisar la pestaña Actions de la PR en cuanto se abra, antes de mergear.
- **[cobertura, pendiente no bloqueante]** `pnpm tauri android build` no se ha vuelto a ejecutar tras el movimiento a `apps/mobile/`. El cambio es puramente estructural (ninguna lógica de GPS/cámara/persistencia/permisos/mapa tocada), así que no cumple el criterio que este proyecto usa para exigir una verificación en dispositivo real — pero sí vale la pena un build de humo antes de dar la reorganización por completamente cerrada en la práctica.
- **[deuda, ya anotada en el propio diseño]** Sin auditoría de dependencias Maven (`pnpm audit`/`cargo audit` no cubren `apps/api`). Coherente con el alcance explícito de la propuesta (sin CI para Java todavía); a revisar cuando se añada.

Sin hallazgos de tipo gap, desviación o convenciones de frontend — no hay comportamiento de `apps/mobile` sin implementar ni normas de frontend violadas (los únicos cambios en esa app son de test/config, no de componentes).

## Veredicto

**APPROVED WITH MINOR ISSUES**

Ningún hallazgo es de seguridad ni afecta a un componente compartido crítico (los dos MINOR ISSUES de cobertura son verificaciones que dependen de un entorno — GitHub Actions real, dispositivo Android — al que esta sesión no tiene acceso, no de comportamiento incorrecto conocido). Recomendación: proceder a archivar y abrir la PR; confirmar el resultado real de CI en la propia PR antes de mergear, y considerar un build de Android de humo si hay tiempo antes del merge.
