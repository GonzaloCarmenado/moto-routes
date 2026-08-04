## MODIFIED Requirements

### Requirement: Las imágenes base coinciden con Debian 13 (trixie)
Para mantener paridad con el servidor de producción real, las imágenes base de ambos servicios SHALL corresponder a Debian 13 (trixie).

#### Scenario: La imagen de PostgreSQL es la variante trixie
- **WHEN** se inspecciona la imagen declarada para el servicio `postgres` en `infra/docker/docker-compose.yml`
- **THEN** usa un tag oficial con sufijo `-trixie` (por ejemplo `postgres:16-trixie`)

#### Scenario: La imagen de la API se basa en Debian 13
- **WHEN** se inspecciona `apps/api/Dockerfile`
- **THEN** la imagen base es `debian:trixie-slim` (o un tag explícito equivalente de Debian 13) con el toolchain/binario de Go, y no una imagen de otra distribución (Ubuntu, Alpine, etc.) ni el JDK que usaba la implementación anterior
