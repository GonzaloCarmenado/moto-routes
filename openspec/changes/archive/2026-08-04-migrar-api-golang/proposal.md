## Why

`apps/api` nació en `entorno-api-docker` ([[ADR-032]]) como Java 21 + Spring Boot, decisión tomada asumiendo que la API crecería más allá del endpoint de prueba (`GET /api/ping`) — pero sin conocer todavía qué funcionalidad concreta traería ese crecimiento. Ahora sí se conoce: validación/autenticación de usuarios, un apartado de seguridad explícito y, a futuro, almacenamiento de blobs tipo Azure Blob Storage y notificaciones en tiempo real tipo SignalR. **Este cambio contradice explícitamente la elección tecnológica de ADR-032** (Spring Boot/Maven) y la sustituye por Go, decisión ya tomada con el usuario: el SDK oficial de Azure Blob Storage es más maduro en Go que en Rust (la alternativa evaluada, coherente con el Rust ya cableado en `apps/mobile/src-tauri`), las librerías de JWT/OAuth están más asentadas, y las goroutines encajan de forma natural con un servidor de notificaciones en tiempo real (mismo motivo por el que Centrifugo, sustituto habitual de SignalR, está escrito en Go). El apartado de seguridad y la autenticación se abordan ahora, antes de que la API tenga más superficie que proteger.

## What Changes

- Sustituir el servicio `apps/api` (Java 21 + Spring Boot 3.5.13 + Maven) por un servicio equivalente en Go, manteniendo el mismo comportamiento observable del endpoint existente (`GET /api/ping`, incluyendo el caso de PostgreSQL no disponible). **BREAKING** para el proceso de build/despliegue: deja de requerir JDK/Maven y pasa a requerir el toolchain de Go; `apps/api/Dockerfile` e `infra/docker/docker-compose*.yml` cambian de imagen base.
- Añadir validación y autenticación de usuarios: registro, login, emisión/verificación de tokens de sesión.
- Añadir un apartado de seguridad explícito para `apps/api`: gestión de secretos, hashing de contraseñas, cabeceras de seguridad HTTP, y una auditoría de dependencias Go equivalente a la que ya existe para pnpm/Cargo.
- Diseñar (sin implementar en este cambio) la superficie de extensión para almacenamiento de blobs tipo Azure Blob Storage y para notificaciones en tiempo real tipo SignalR, de modo que `user-auth`/`api-security` no bloqueen esas dos extensiones futuras.

## Capabilities

### New Capabilities
- `user-auth`: registro, login, verificación de credenciales y emisión/validación de tokens de sesión para usuarios de la API.
- `api-security`: postura de seguridad propia de `apps/api` — gestión de secretos, hashing de contraseñas, cabeceras HTTP de seguridad, y auditoría de vulnerabilidades de dependencias Go bloqueante en el pre-commit/CI (equivalente a `security-audit`, pero para el árbol de dependencias Go en vez de pnpm/Cargo).

### Modified Capabilities
- `api-backend`: dejan de ser válidas las referencias a Java como lenguaje de implementación (Purpose actual dice literalmente "Servicio backend mínimo en Java"); se añade el requisito de que la migración preserve el comportamiento observable de los endpoints ya existentes.
- `local-dev-environment`: el escenario "La imagen de la API se basa en Debian 13" asume explícitamente JDK vía `apt` — pasa a asumir el toolchain/binario de Go en su lugar, manteniendo la base Debian 13 (trixie).

## Impact

- **Código afectado**: todo `apps/api/src/main/java/**` y `apps/api/src/test/java/**` (incluye `MotoRoutesApiApplication`, `ping/{PingController,PingService,PingResult}`, `PingControllerTest`) se sustituye por su equivalente Go. `apps/api/pom.xml`, `apps/api/mvnw`/`mvnw.cmd`, `apps/api/.mvn/` y `apps/api/src/main/resources/application.properties` se retiran; les sustituyen los ficheros de módulo Go (`go.mod`/`go.sum`) y su propio mecanismo de configuración por entorno.
- **Docker/infra**: `apps/api/Dockerfile` (multi-stage `debian:trixie`/`debian:trixie-slim` con JDK vía `apt`) pasa a un build Go sobre la misma familia Debian trixie. `infra/docker/docker-compose.yml` y `infra/docker/docker-compose.prod.yml` referencian la nueva imagen; la restricción de escucha únicamente en la interfaz Tailscale ([[ADR-033]], `server-deployment`) se conserva como requisito, cambia solo su mecanismo de configuración (ya no una property de Spring Boot).
- **CI**: `.github/workflows/ci.yml` pierde el job/pasos específicos de Maven (`quality-tauri`/`quality-ts` no se tocan) y gana los equivalentes Go (build, test, lint, auditoría de dependencias) — mismo patrón que `ci-cd-pipeline` ([[ADR-031]]).
- **Memoria**: este cambio contradice la elección de stack de [[ADR-032]] — se documentará una ADR nueva en `memory/decisions.md` registrando la sustitución Java → Go y su motivo, sin invalidar el resto de decisiones de ADR-032 (estructura de monorepo, ausencia de herramienta de migraciones) ni de [[ADR-033]] (despliegue vía Tailscale, reutilización del PostgreSQL nativo).
- **Fuera de alcance de este cambio**: la implementación real de almacenamiento de blobs y de notificaciones en tiempo real — solo se diseña la superficie de extensión, no el código.
