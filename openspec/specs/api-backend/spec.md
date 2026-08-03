# api-backend Specification

## Purpose

Servicio backend mínimo en Java que expone un endpoint de prueba capaz de confirmar, de forma verificable, que la API responde y que su conexión a PostgreSQL funciona de verdad.

## Requirements

### Requirement: El endpoint de prueba verifica la conectividad real con la base de datos
La API SHALL exponer un endpoint HTTP (por ejemplo `GET /api/ping` o `GET /api/health`) que, al ser invocado, ejecute una consulta real contra PostgreSQL en vez de devolver una respuesta estática, de modo que su resultado refleje el estado real de la conexión JDBC.

#### Scenario: El endpoint responde correctamente cuando la base de datos está disponible
- **WHEN** un cliente hace `GET` al endpoint de prueba mientras PostgreSQL está accesible y la tabla dummy existe
- **THEN** la API responde con estado 200 y un cuerpo JSON que incluye un dato leído de verdad de la tabla (por ejemplo, un timestamp o un conteo de filas), no un valor fijo en código

#### Scenario: El endpoint informa del fallo cuando la base de datos no está disponible
- **WHEN** PostgreSQL no está accesible (conexión rechazada o timeout)
- **THEN** la API responde con un estado de error (por ejemplo 503) y un cuerpo que indica el fallo de conectividad, sin caerse ni quedarse colgada indefinidamente

### Requirement: La configuración de conexión no contiene secretos en código
La cadena de conexión y credenciales de PostgreSQL SHALL leerse desde variables de entorno en tiempo de ejecución. Ningún fichero versionado del servicio SHALL contener usuario, contraseña o cadena de conexión en texto plano.

#### Scenario: No hay credenciales hardcodeadas en el código fuente
- **WHEN** se inspeccionan los ficheros versionados de `apps/api` (código fuente, `application.properties`/`application.yml`, `Dockerfile`)
- **THEN** ningún fichero contiene una contraseña o cadena de conexión real; los valores se referencian como variables de entorno (por ejemplo `${DB_PASSWORD}`)
