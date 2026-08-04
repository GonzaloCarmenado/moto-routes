## MODIFIED Requirements

### Requirement: El endpoint de prueba verifica la conectividad real con la base de datos
La API SHALL exponer un endpoint HTTP (por ejemplo `GET /api/ping` o `GET /api/health`) que, al ser invocado, ejecute una consulta real contra PostgreSQL en vez de devolver una respuesta estática, de modo que su resultado refleje el estado real de la conexión.

#### Scenario: El endpoint responde correctamente cuando la base de datos está disponible
- **WHEN** un cliente hace `GET` al endpoint de prueba mientras PostgreSQL está accesible y la tabla dummy existe
- **THEN** la API responde con estado 200 y un cuerpo JSON que incluye un dato leído de verdad de la tabla (por ejemplo, un timestamp o un conteo de filas), no un valor fijo en código

#### Scenario: El endpoint informa del fallo cuando la base de datos no está disponible
- **WHEN** PostgreSQL no está accesible (conexión rechazada o timeout)
- **THEN** la API responde con un estado de error (por ejemplo 503) y un cuerpo que indica el fallo de conectividad, sin caerse ni quedarse colgada indefinidamente

### Requirement: La configuración de conexión no contiene secretos en código
La cadena de conexión y credenciales de PostgreSQL SHALL leerse desde variables de entorno en tiempo de ejecución. Ningún fichero versionado del servicio SHALL contener usuario, contraseña o cadena de conexión en texto plano.

#### Scenario: No hay credenciales hardcodeadas en el código fuente
- **WHEN** se inspeccionan los ficheros versionados de `apps/api` (código fuente, ficheros de configuración, `Dockerfile`)
- **THEN** ningún fichero contiene una contraseña o cadena de conexión real; los valores se referencian como variables de entorno

## ADDED Requirements

### Requirement: La migración de implementación preserva el comportamiento observable existente
Al sustituir la implementación de `apps/api`, el comportamiento observable de los endpoints ya existentes en el momento de la migración SHALL permanecer igual: mismas rutas, mismos códigos de estado y mismo formato de respuesta ante los mismos escenarios (base de datos disponible o no disponible).

#### Scenario: El endpoint de prueba responde igual que antes de la migración
- **WHEN** se invoca `GET /api/ping` tras la migración, en las mismas condiciones (PostgreSQL disponible) que antes de la migración
- **THEN** la API responde con el mismo código de estado (200) y un cuerpo JSON con la misma estructura que antes de la migración

#### Scenario: El comportamiento ante base de datos no disponible se mantiene
- **WHEN** PostgreSQL no está accesible, igual que en el comportamiento ya definido antes de la migración
- **THEN** la API responde con el mismo código de estado de error (503) que antes de la migración, sin caerse ni quedarse colgada indefinidamente
