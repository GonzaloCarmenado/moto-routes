# local-dev-environment Specification

## Purpose

Entorno de desarrollo local reproducible vía Docker Compose que levanta la API y PostgreSQL juntas, usando imágenes base que coinciden con el sistema operativo real del servidor de producción (Debian 13 / trixie).

## Requirements

### Requirement: Docker Compose levanta la API y PostgreSQL con un único comando
`infra/docker/docker-compose.yml` SHALL definir un servicio `api` y un servicio `postgres` que arrancan juntos y quedan operativos sin pasos manuales adicionales.

#### Scenario: El stack completo arranca con un solo comando
- **WHEN** un desarrollador ejecuta `docker compose up` desde `infra/docker`
- **THEN** ambos contenedores (`api` y `postgres`) arrancan, el servicio `api` espera/reintenta hasta que `postgres` esté listo, y una petición al endpoint de prueba devuelve éxito en un tiempo de arranque acotado

### Requirement: Las imágenes base coinciden con Debian 13 (trixie)
Para mantener paridad con el servidor de producción real, las imágenes base de ambos servicios SHALL corresponder a Debian 13 (trixie).

#### Scenario: La imagen de PostgreSQL es la variante trixie
- **WHEN** se inspecciona la imagen declarada para el servicio `postgres` en `infra/docker/docker-compose.yml`
- **THEN** usa un tag oficial con sufijo `-trixie` (por ejemplo `postgres:16-trixie`)

#### Scenario: La imagen de la API se basa en Debian 13
- **WHEN** se inspecciona `apps/api/Dockerfile`
- **THEN** la imagen base es `debian:trixie-slim` (o un tag explícito equivalente de Debian 13) con el JDK instalado vía `apt`, y no una imagen de otra distribución (Ubuntu, Alpine, etc.)

### Requirement: Los datos de PostgreSQL persisten entre reinicios del entorno local
El servicio `postgres` SHALL usar un volumen de Docker para persistir sus datos, de modo que la información no se pierda al detener y volver a levantar el stack.

#### Scenario: Reiniciar el stack conserva los datos de la tabla dummy
- **WHEN** un desarrollador detiene el stack (`docker compose down`, sin eliminar volúmenes) y vuelve a levantarlo (`docker compose up`)
- **THEN** las filas insertadas previamente en la tabla dummy siguen presentes
