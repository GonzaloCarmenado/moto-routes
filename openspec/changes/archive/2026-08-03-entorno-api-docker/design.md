## Context

Ver `proposal.md` para el porqué. Estado actual relevante para el "cómo":

- El repo hoy es un único paquete pnpm en la raíz: `pnpm-workspace.yaml` **no tiene campo `packages:`** — solo `allowBuilds` y `overrides` — así que no hay workspace multi-paquete real que migrar, solo que crear.
- `.github/workflows/ci.yml` (jobs `quality-ts`/`quality-tauri`) y `.husky/pre-commit` ejecutan sus comandos (`pnpm install`, `pnpm exec tsc`, `pnpm exec eslint src/`, `cargo` dentro de `src-tauri/`, `pnpm test:e2e`) asumiendo que la app móvil vive en la raíz.
- No existe ningún backend, ni configuración de Docker, ni dependencia Java/Maven en el repo hoy.
- `openspec/specs/` solo tiene dos capabilities transversales (`ci-cd`, `security-audit`); no hay ninguna capability previa de backend/infra que este cambio deba respetar o modificar.

Decisiones de arquitectura de este cambio registradas en [[ADR-032]] (`memory/decisions.md`) — aquí se explica el "cómo" de implementarlas, no se repite el porqué.

## Goals / Non-Goals

**Goals:**
- Reorganizar el repo a monorepo (`apps/mobile`, `apps/api`, `infra/docker`) sin romper ningún test, build ni gate de CI existente de la app móvil.
- Servicio Spring Boot mínimo con un endpoint que demuestre conectividad JDBC real con Postgres.
- `docker compose up` desde `infra/docker` como único comando para tener API + Postgres funcionando en local.
- Imágenes base Debian 13 (trixie) en ambos servicios Docker, coherentes con el servidor de producción real.

**Non-Goals:**
- Autenticación o autorización en la API.
- Herramienta de migraciones dedicada (Flyway/Liquibase) — se pospone explícitamente (ver ADR-032, punto 4).
- CI (GitHub Actions) para el servicio Java — este cambio no añade un job nuevo a `ci.yml` para `apps/api`.
- Despliegue real al servidor Debian 13 de producción — esta spec cubre solo el entorno local.
- Cualquier modelo de dominio real de Moto Routes en Postgres — la tabla es deliberadamente dummy.

## Decisions

### Estructura de carpetas
`apps/mobile/` recibe, vía `git mv` (preserva historial), todo el contenido de raíz específico de la app móvil: `src/`, `src-tauri/`, `cypress/`, `tests/`, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `.prettierrc`, `cypress.config.ts`, `vitest.config.ts`, `eslint.config.js`, `clippy.toml`, y los scripts de utilidad exclusivos de la app móvil (`scripts/kill-port.mjs`, `scripts/setup-android.sh`, `scripts/pull-db.{cmd,ps1}`, no referenciados desde CI ni desde ningún otro sitio). `pnpm-workspace.yaml` se queda en la raíz (es config del gestor de paquetes, no de un paquete concreto) con `packages: ['apps/mobile']`.

**Corrección encontrada durante `apply` (no prevista al escribir la propuesta)**: `typedoc.json`, `scripts/docs-coverage.mjs` y `scripts/docs-prepare.mjs` **NO** se mueven a `apps/mobile/` — leen `memory/decisions.md` y `specs/ui/design-system.md` y escriben en `docs/reference/`/`docs/api/`, todos ellos ficheros que se quedan en la raíz (transversales, no exclusivos de la app móvil). Moverlos junto con `apps/mobile/` habría roto sus rutas relativas (`docs-prepare.mjs` calcula su raíz a partir de la ubicación del propio script; `docs-coverage.mjs` resuelve `docs/api/coverage.json` relativo al directorio de trabajo del proceso `node`). Se quedan en la raíz, junto a un **`package.json` raíz nuevo** (mínimo: `type: module`, `private: true`, scripts `docs:api`/`docs:coverage`/`docs:prepare`/`docs:build`/`docs:rust`/`docs`, y como únicas `devDependencies` `typedoc`, `typedoc-plugin-coverage` y `vitepress` — las mismas tres que ya estaban en el `package.json` único, ninguna dependencia nueva). `pnpm-lock.yaml` también se queda en la raíz: un workspace pnpm tiene un único lockfile para todos sus paquetes (raíz + `apps/mobile`), nunca uno por paquete — no se puede mover a `apps/mobile/` como decía la propuesta inicial. `typedoc.json` actualiza `entryPoints` a `["apps/mobile/src"]` y `tsconfig` a `"./apps/mobile/tsconfig.json"`; `docs:rust` pasa a `cd apps/mobile/src-tauri && cargo doc --no-deps`.

`apps/api/` es un proyecto Maven estándar (`pom.xml`, `mvnw`/`mvnw.cmd`/`.mvn/`, `src/main/java/...`, `src/main/resources/application.properties`, `Dockerfile`), completamente fuera del workspace pnpm.

`infra/docker/docker-compose.yml` es el único fichero de orquestación; no necesita `.env` versionado (las variables de conexión se definen inline en el compose para desarrollo local, ver más abajo por qué eso no es un secreto real).

### Framework y persistencia en `apps/api`
Spring Boot (`spring-boot-starter-web` + `spring-boot-starter-jdbc`) con Maven. Para una única tabla y una única consulta, `JdbcTemplate` directo es suficiente y evita el coste de arranque y la complejidad de mapeo de JPA/Hibernate — no hay entidades de dominio que justifiquen un ORM todavía. Si el modelo de datos crece en una spec futura, revisar si migrar a Spring Data JPA en ese momento.

El endpoint de prueba (`GET /api/ping`) ejecuta `SELECT NOW()` (o un `SELECT count(*)`/última fila) contra la tabla dummy y devuelve el resultado en el JSON de respuesta — así una respuesta 200 es evidencia real de que JDBC funciona, no una comprobación superficial del proceso Spring Boot.

### Tabla dummy y arranque de esquema
Una única tabla, p. ej. `healthcheck(id SERIAL PRIMARY KEY, checked_at TIMESTAMPTZ NOT NULL DEFAULT now())`, creada por un script `infra/docker/postgres/init.sql` montado en `/docker-entrypoint-initdb.d/` del contenedor oficial de Postgres — mecanismo nativo de la imagen (se ejecuta una sola vez, en el primer arranque con el volumen de datos vacío). Sin dependencia de Flyway/Liquibase (ver Non-Goals).

### Dockerfile de `apps/api` (multi-stage, ambas etapas Debian 13)
- **Etapa `build`**: `FROM debian:trixie AS build`, instala `default-jdk-headless` (o `openjdk-21-jdk-headless` si el metapaquete `default-jdk` no resuelve a 21 en trixie — confirmar versión exacta disponible al implementar) y Maven vía `apt-get`, copia el proyecto y ejecuta `./mvnw package -DskipTests` (los tests corren antes en local/CI, no dentro de la imagen).
- **Etapa `runtime`**: `FROM debian:trixie-slim`, instala solo `openjdk-21-jre-headless` (JRE, no JDK completo — imagen final más pequeña), copia el `.jar` generado desde `build`, `ENTRYPOINT ["java", "-jar", "app.jar"]`.
- Motivo de partir de `debian:*` genérico e instalar el JDK/JRE por `apt` en vez de una imagen Java ya construida: `eclipse-temurin` (la imagen oficial de OpenJDK) no publica todavía ninguna variante trixie (ver ADR-032) — no hay ninguna imagen Java oficial que sea Debian 13 hoy.

### Configuración de conexión (sin secretos en código)
`application.properties` referencia `${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}` (Spring Boot los resuelve también desde variables de entorno `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` sin fichero adicional). `docker-compose.yml` no hardcodea ningún valor: usa `${POSTGRES_DB}`/`${POSTGRES_USER}`/`${POSTGRES_PASSWORD}`, resueltas por Docker Compose desde `infra/docker/.env` (no versionado, en `.gitignore`) a partir de `infra/docker/.env.example` (sí versionado, documenta las claves esperadas sin valores reales) — cumple la regla del proyecto de "nunca secretos en código" incluso siendo un valor trivial de solo desarrollo, ya que Postgres solo es alcanzable dentro de la red interna de Docker Compose, nunca expuesto a producción con estas credenciales (ver Non-Goals: no hay despliegue real todavía).

### Qué no se toca de `openspec/config.yaml`
Las reglas de `data-cy`, tokens CSS, Shadow DOM y JSDoc del `context`/`rules` del proyecto son específicas del frontend TypeScript de `apps/mobile` y no aplican a `apps/api` (Java no tiene Shadow DOM ni `data-cy`). El equivalente Java es Javadoc conciso en clases/métodos públicos del servicio — mismo criterio de "qué y por qué, no cómo" que ya aplica en TS, sin que haga falta una regla nueva para expresarlo.

## Risks / Trade-offs

- **[Riesgo] Blast radius de la reorganización mayor de lo previsto** — algún script o ruta relativa a la raíz que no se detecte en el audit inicial (p. ej. dentro de `docs/` o de un `package.json`/`scripts`) queda roto tras el `git mv`. → **Mitigación**: grep explícito de rutas hardcodeadas (`src/`, `src-tauri/`, rutas relativas) sobre todo el repo antes y después del movimiento, no solo sobre los ficheros ya identificados en el Impact de la propuesta; el test de regresión existente `src/shared/ci/ci-workflow.spec.ts` (movido con el resto de `apps/mobile`) se actualiza para verificar las rutas nuevas del workflow.
- **[Riesgo] El paquete `openjdk-21-jdk-headless` podría no estar disponible tal cual en los repos de Debian 13 en el momento de implementar** (nombre exacto de paquete puede variar entre `openjdk-21-jdk-headless` y el metapaquete `default-jdk`). → **Mitigación**: verificar en `apply` construyendo la imagen; si `21` no está disponible, usar la versión de OpenJDK que sí lo esté en trixie (17 LTS como alternativa) — no cambia ningún requisito de la spec, que no fija una versión concreta de JDK.
- **[Riesgo] Postgres no está listo cuando arranca `api` en `docker compose up`** (orden de arranque de Compose no espera a que el servicio esté realmente aceptando conexiones, solo a que el contenedor exista). → **Mitigación**: `depends_on` con `condition: service_healthy` + `healthcheck` (`pg_isready`) en el servicio `postgres`, y reintento de conexión con backoff en el arranque de Spring Boot (comportamiento por defecto del starter JDBC es fallar rápido — configurar `spring.datasource.hikari.connection-timeout` y reintentos si hace falta, o confiar en el healthcheck de Compose como primera barrera).
- **[Trade-off] Sin Flyway/Liquibase desde el principio** — cuando el esquema crezca, migrar de `init.sql` a una herramienta de migraciones exigirá un cambio no trivial (recrear el historial de migraciones desde el estado actual). Aceptado explícitamente por alcance mínimo (ver Non-Goals); revisar en la primera spec que amplíe el modelo de datos.

## Migration Plan

1. Auditar rutas hardcodeadas a la raíz en `.github/workflows/ci.yml`, `.husky/pre-commit`, `docs/` y cualquier script de `package.json`.
2. `git mv` de los ficheros/carpetas de la app móvil a `apps/mobile/` (preserva historial de Git).
3. Actualizar `pnpm-workspace.yaml` (`packages: ['apps/mobile']`), `.github/workflows/ci.yml`, `.husky/pre-commit` y scripts de `docs/` para las nuevas rutas.
4. Verificar en local que `pnpm install`, `pnpm build`, `pnpm test` (Vitest), `pnpm test:e2e` (Cypress) y `cargo test`/`clippy`/`fmt` (desde `apps/mobile/src-tauri`) siguen funcionando igual que antes del movimiento.
5. Crear `apps/api/` (proyecto Maven + Spring Boot) y `infra/docker/` en paralelo — no dependen de que (1)-(4) estén terminados, pueden desarrollarse simultáneamente.
6. `docker compose up` desde `infra/docker` y verificar manualmente que el endpoint de prueba responde con datos reales de Postgres.
7. Actualizar `memory/context.md` con el nuevo estado (monorepo, servicio `apps/api`) al cerrar el cambio.

No hay plan de rollback de datos porque no existe ningún dato de producción afectado — el backend y su base de datos son nuevos y solo existen en local en este alcance.
