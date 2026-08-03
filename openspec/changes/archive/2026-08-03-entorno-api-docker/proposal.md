## Why

Moto Routes solo existe hoy como app móvil (Tauri + frontend) con persistencia local en SQLite. No hay ningún backend propio: no hay dónde sincronizar rutas entre dispositivos, ni servidor sobre el que construir funcionalidad futura de servidor (cuentas, compartir rutas, etc.). El primer paso concreto es levantar un entorno mínimo de API + base de datos, reproducible en local con Docker, que además cuadre con el sistema operativo real del servidor de producción (Debian 13). Como el repositorio pasa a tener dos aplicaciones de naturaleza muy distinta (app móvil Tauri/TypeScript vs servicio Java), hace falta reorganizarlo como monorepo antes de que el código nuevo se mezcle en la raíz junto al de la app móvil.

## What Changes

- Reorganizar el repositorio a estructura de monorepo: todo lo que hoy vive en la raíz correspondiente a la app móvil (`src/`, `src-tauri/`, `cypress/`, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `tests/`, configs de lint/format/test asociados) se mueve a `apps/mobile/`. **BREAKING** para cualquier script o ruta que asuma hoy que la app móvil vive en la raíz (`pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.husky/pre-commit`, scripts de `docs/`, configs de Vitest/Cypress).
- Nuevo servicio backend en `apps/api/`: proyecto Java (Spring Boot, Maven con wrapper `mvnw`) con un único endpoint de prueba que consulta PostgreSQL de verdad (no una respuesta estática), para validar la conexión JDBC end-to-end.
- Nueva base de datos PostgreSQL con una única tabla dummy sin acoplarse a ningún dominio real de Moto Routes todavía (solo para verificar que API y BBDD se hablan correctamente).
- Nuevo `infra/docker/` con `docker-compose.yml` que levanta `api` + `postgres` para desarrollo local, usando imágenes base Debian 13 (trixie) en ambos servicios para tener paridad con el servidor real de producción.
- `openspec/`, `specs/`, `docs/`, `memory/`, `.github/` no se mueven — siguen siendo transversales al monorepo, no exclusivos de la app móvil.

Fuera de alcance explícitamente (a petición del usuario, entorno "muy sencillo" por ahora): autenticación, migraciones con herramienta dedicada (Flyway/Liquibase — se decide en `design.md` si hace falta ya o se pospone), pipeline de CI para el servicio Java, y cualquier despliegue real al servidor Debian 13 de producción.

## Capabilities

### New Capabilities
- `monorepo-layout`: estructura de carpetas del repositorio como monorepo (`apps/mobile/`, `apps/api/`, `infra/docker/`) y qué vive dónde.
- `api-backend`: servicio Java/Spring Boot con el endpoint de prueba que consulta PostgreSQL.
- `local-dev-environment`: entorno de desarrollo local vía Docker Compose (api + postgres, imágenes base Debian 13).

### Modified Capabilities
(ninguna — no existe ninguna capability previa en `openspec/specs/` sobre backend, infraestructura o estructura de repositorio; `ci-cd` y `security-audit` son transversales pero sus requisitos actuales no cambian en este alcance, solo las rutas de fichero que ya cubre `monorepo-layout`)

## Impact

- **Movidos** (sin cambio de contenido, solo de ubicación): `src/`, `src-tauri/`, `cypress/`, `index.html`, `vite.config.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tests/`, `.prettierrc`, `cypress.config.ts`, `vitest.config.ts`, `eslint.config.js`, `clippy.toml`, `typedoc.json` → todos bajo `apps/mobile/`.
- **Modificados**: `pnpm-workspace.yaml` (apunta a `apps/mobile` como único paquete pnpm real), `.github/workflows/ci.yml` (rutas de checkout/build/test), `.husky/pre-commit` (rutas de los comandos que hoy asumen raíz), scripts de `docs/` (typedoc/vitepress, si referencian rutas relativas a la raíz).
- **Nuevos**: `apps/api/` (proyecto Maven completo: `pom.xml`, `mvnw`, `src/main/java/...`, `Dockerfile`), `infra/docker/docker-compose.yml`.
- **Dependencias nuevas**: Spring Boot (Web + JDBC/Data), driver JDBC de PostgreSQL, Maven Wrapper. Ninguna dependencia nueva del lado TypeScript/Rust.
- **No afectado**: `openspec/`, `specs/features/` (congelado), `docs/`, `memory/`, lógica de la app móvil (Tauri, cockpit, routes, profile) — solo cambia su ubicación en disco, no su comportamiento.
