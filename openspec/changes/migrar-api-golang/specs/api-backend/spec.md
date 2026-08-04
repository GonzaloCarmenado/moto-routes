## ADDED Requirements

### Requirement: La migración de implementación preserva el comportamiento observable existente
Al sustituir la implementación de `apps/api`, el comportamiento observable de los endpoints ya existentes en el momento de la migración SHALL permanecer igual: mismas rutas, mismos códigos de estado y mismo formato de respuesta ante los mismos escenarios (base de datos disponible o no disponible).

#### Scenario: El endpoint de prueba responde igual que antes de la migración
- **WHEN** se invoca `GET /api/ping` tras la migración, en las mismas condiciones (PostgreSQL disponible) que antes de la migración
- **THEN** la API responde con el mismo código de estado (200) y un cuerpo JSON con la misma estructura que antes de la migración

#### Scenario: El comportamiento ante base de datos no disponible se mantiene
- **WHEN** PostgreSQL no está accesible, igual que en el comportamiento ya definido antes de la migración
- **THEN** la API responde con el mismo código de estado de error (503) que antes de la migración, sin caerse ni quedarse colgada indefinidamente
