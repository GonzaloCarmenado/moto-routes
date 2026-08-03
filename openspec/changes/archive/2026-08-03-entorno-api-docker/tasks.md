## 1. Auditoría previa a la reorganización

- [x] 1.1 Buscar en todo el repo (no solo en los ficheros ya listados en `proposal.md` § Impact) referencias a rutas relativas a la raíz que asuman la ubicación actual de la app móvil: `.github/workflows/ci.yml`, `.husky/pre-commit`, `scripts/*.mjs` (typedoc/vitepress), `package.json` (`scripts`), `vitest.config.ts`, `cypress.config.ts`, `typedoc.json`, `tsconfig.json` (paths), `.gitignore`.
- [x] 1.2 Anotar en este mismo fichero (o en un comentario de PR) cualquier referencia encontrada que no estuviera ya prevista en `design.md` § Migration Plan, antes de mover nada.

## 2. Reorganización a monorepo (`apps/mobile`)

- [x] 2.1 Crear `apps/mobile/` y mover con `git mv` (preserva historial): `src/`, `src-tauri/`, `cypress/`, `tests/`, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `.prettierrc`, `cypress.config.ts`, `vitest.config.ts`, `eslint.config.js`, `clippy.toml`, `scripts/kill-port.mjs`, `scripts/setup-android.sh`, `scripts/pull-db.cmd`, `scripts/pull-db.ps1`. **`pnpm-lock.yaml` y `typedoc.json` NO se mueven** — ver 2.2/2.4 (gap encontrado durante `apply`, documentado en `design.md`).
- [x] 2.2 Actualizar `pnpm-workspace.yaml` en la raíz: añadir `packages: ['apps/mobile']` sin tocar `allowBuilds`/`overrides` existentes. `pnpm-lock.yaml` se queda en la raíz (lockfile único del workspace).
- [x] 2.3 Actualizar rutas relativas dentro de los ficheros movidos que asuman raíz de repo (p. ej. referencias a `../` en configs). Verificado: `vite.config.ts`/`vitest.config.ts`/`eslint.config.js` ya usaban `__dirname`/`import.meta.dirname`, sin cambios necesarios.
- [x] 2.4 Crear un `package.json` raíz nuevo (mínimo: `private: true`, `type: module`, scripts `docs:api`/`docs:coverage`/`docs:prepare`/`docs:build`/`docs:rust`/`docs`, `devDependencies`: `typedoc`, `typedoc-plugin-coverage`, `vitepress` — las mismas ya existentes, sin añadir ninguna). Actualizar `typedoc.json` (se queda en la raíz): `entryPoints: ["apps/mobile/src"]`, `tsconfig: "./apps/mobile/tsconfig.json"`. Actualizar `docs:rust` a `cd apps/mobile/src-tauri && cargo doc --no-deps`. `scripts/docs-coverage.mjs` y `scripts/docs-prepare.mjs` se quedan en `scripts/` de la raíz, sin cambios (ya resuelven sus rutas de forma correcta para seguir en la raíz).

## 3. Actualizar tooling de calidad para las rutas nuevas (TDD: test en rojo antes que el fix)

- [x] 3.1 Actualizar `src/shared/ci/ci-workflow.spec.ts` (ahora en `apps/mobile/src/shared/ci/`) para que espere las rutas/comandos nuevos de `apps/mobile` en `.github/workflows/ci.yml` — confirmado rojo contra el `ci.yml` todavía sin actualizar.
- [x] 3.2 Actualizar `.github/workflows/ci.yml` (jobs `quality-ts`/`quality-tauri`/`build-and-release`) para operar sobre `apps/mobile` (`working-directory` por paso) — confirmado verde (24/24 assertions) tras el cambio.
- [x] 3.3 Localizar y actualizar de forma análoga el test de regresión existente sobre `.husky/pre-commit` (`pre-commit-audit-gate.spec.ts`): rojo con las rutas nuevas esperadas, luego actualizado `.husky/pre-commit` para ejecutar sus comandos dentro de `apps/mobile`/`apps/mobile/src-tauri`, confirmado verde (6/6).
- [x] 3.4 `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` sigue en la raíz (instala raíz + workspace `apps/mobile` con el lockfile único); el paso "Documentation coverage" (`pnpm run docs:coverage`) se ejecuta contra el `package.json` raíz nuevo (task 2.4), sin `working-directory`.

## 4. Verificar que la app móvil sigue intacta tras el movimiento

- [x] 4.1 Desde `apps/mobile`: `pnpm exec tsc --noEmit` (sin errores), `pnpm exec eslint src/ --max-warnings 0` (sin issues), `pnpm exec vitest run --coverage` (759/759 tests, 246 suites, cobertura ≥80%) — sin regresiones tras la reorganización.
- [x] 4.2 Desde `apps/mobile/src-tauri`: `cargo fmt --check` (limpio), `cargo clippy -- -D warnings` (limpio tras `cargo clean` — el `target/` movido con `git mv` traía rutas absolutas cacheadas de la ubicación anterior, gap real encontrado y resuelto en esta sesión), `cargo test` (5/5) — 0 regresiones.
- [x] 4.3 `pnpm test:e2e` (Cypress) desde `apps/mobile` — 39/39 tests E2E en verde (6 specs).
- [ ] 4.4 Abrir un PR de prueba (o tag de prueba si aplica) para confirmar que el pipeline de GitHub Actions actualizado en 3.2 pasa en un runner real, no solo localmente — mismo criterio que exigió ADR-031 para cambios de CI.

## 5. Servicio `apps/api` (Spring Boot + Maven)

- [x] 5.1 Generar el esqueleto Maven (`pom.xml`, wrapper `mvnw`/`mvnw.cmd`/`.mvn/`) con dependencias `spring-boot-starter-web`, `spring-boot-starter-jdbc` y el driver JDBC de PostgreSQL. Spring Boot 3.5.13 (parent `spring-boot-starter-parent`), Java 21. Wrapper generado con el plugin oficial `maven-wrapper-plugin:3.3.2` (Maven 3.9.9) vía un contenedor Docker desechable, sin instalar Maven en local.
- [x] 5.2 Escribir el test unitario del endpoint de prueba primero (rojo): con `JdbcTemplate` mockeado (Mockito), verificar que una consulta exitosa produce una respuesta 200 con el dato leído, y que una excepción de conexión produce una respuesta de error (503) sin lanzar una excepción no controlada. `PingControllerTest` — confirmado rojo (error de compilación, clases inexistentes) antes de implementar.
- [x] 5.3 Implementar el controlador/servicio mínimo (`GET /api/ping`) que hace pasar el test de 5.2 a verde — consulta real a la tabla dummy (`SELECT now()`), sin respuesta estática. `PingController`/`PingService`/`PingResult` — confirmado verde (2/2 tests, `mvn test` vía contenedor Maven, `BUILD SUCCESS`).
- [x] 5.4 Configurar `application.properties` para leer `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` desde variables de entorno, sin ningún valor hardcodeado en el fichero.
- [x] 5.5 Añadir Javadoc conciso (qué y por qué, no cómo) a las clases y métodos públicos del servicio, siguiendo el mismo criterio que ya exige JSDoc en el frontend.

## 6. Infraestructura Docker (Debian 13 / trixie)

- [x] 6.1 Crear `apps/api/Dockerfile` multi-stage: etapa `build` desde `debian:trixie` con JDK + Maven vía `apt`, etapa `runtime` desde `debian:trixie-slim` con solo el JRE vía `apt`. Confirmado en un contenedor real: `openjdk-21-jdk-headless`/`openjdk-21-jre-headless` y `maven` (3.9.9-1) existen tal cual en los repos de trixie — sin necesidad de fallback a JDK 17.
- [x] 6.2 Crear `infra/docker/postgres/init.sql` con la tabla dummy (`healthcheck`) para `docker-entrypoint-initdb.d/`.
- [x] 6.3 Crear `infra/docker/docker-compose.yml`: servicio `postgres` (`postgres:16-trixie`, volumen persistente, `healthcheck` con `pg_isready`) y servicio `api` (build desde `apps/api/Dockerfile`, variables de entorno `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`, `depends_on` con `condition: service_healthy`). Credenciales vía `infra/docker/.env` (gitignored) + `.env.example` versionado — ninguna hardcodeada en el compose (gap encontrado durante `apply`: la regla del proyecto de "nunca secretos en código" no tiene excepción para valores triviales; ver `design.md`).

## 7. Verificación end-to-end local

- [x] 7.1 `docker compose up --build` desde `infra/docker` — ambos contenedores arrancan sin error (`postgres` sano vía `pg_isready`, luego `api`).
- [x] 7.2 `curl http://localhost:8080/api/ping` → `200 {"healthy":true,"databaseTime":"...","error":null}` — dato real leído de Postgres, no estático.
- [x] 7.3 `INSERT` manual en `healthcheck`, `docker compose down` (sin `-v`) + `docker compose up` — la fila sigue presente tras el reinicio.
- [x] 7.4 `docker stop` del contenedor `postgres` con la API arriba → `curl` responde `503 {"healthy":false,...,"error":"Failed to obtain JDBC Connection"}`, sin crash ni cuelgue.

## 8. Cierre

- [x] 8.1 Actualizar `memory/context.md` con el nuevo estado del proyecto: monorepo (`apps/mobile`, `apps/api`, `infra/docker`), servicio Java mínimo operativo en local, referencia a este cambio y a [[ADR-032]].
- [x] 8.2 Confirmar que `openspec validate --changes entorno-api-docker --strict` pasa antes de invocar `/opsx:archive`. ✓ (1 passed, 0 failed)
