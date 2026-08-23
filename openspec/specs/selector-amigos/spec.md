# selector-amigos Specification

## Purpose

Permite buscar cuentas registradas por nombre de usuario parcial y verlas con su avatar, como base de un selector reutilizable siempre que la app necesite que alguien elija a otra cuenta (enviar una solicitud de amistad, invitar a compartir una ruta, y cualquier caso futuro similar).

## Requirements

### Requirement: Buscar cuentas por nombre de usuario parcial
La API SHALL permitir a cualquier usuario con sesión activa buscar cuentas registradas cuyo `username` contenga la cadena de búsqueda recibida, devolviendo una lista acotada de resultados con el `username` de cada cuenta — SHALL NOT incluir el email ni ningún otro dato personal en la respuesta.

#### Scenario: Búsqueda con resultados coincidentes
- **WHEN** un usuario con sesión activa busca una cadena que coincide con el username de una o más cuentas registradas
- **THEN** la API responde con la lista de usernames coincidentes, sin exponer el email de ninguna de esas cuentas

#### Scenario: Búsqueda sin ninguna coincidencia
- **WHEN** un usuario con sesión activa busca una cadena que no coincide con ningún username registrado
- **THEN** la API responde con una lista vacía, no con un error

#### Scenario: Los resultados están acotados a un máximo
- **WHEN** una búsqueda coincide con más cuentas de las que caben en el límite de resultados de una sola respuesta
- **THEN** la API devuelve solo hasta ese límite, sin fallar ni devolver la lista completa

#### Scenario: Límite de búsquedas por cuenta en poco tiempo
- **WHEN** un usuario con sesión activa realiza búsquedas repetidas por encima del límite permitido en un intervalo corto de tiempo
- **THEN** la API rechaza las peticiones adicionales con un error de límite de tasa, sin bloquear el resto de la app

#### Scenario: Buscar sin sesión activa
- **WHEN** una petición de búsqueda llega sin un token de sesión válido
- **THEN** la API la rechaza con un error de autenticación, sin devolver ningún resultado

### Requirement: Ver el avatar de otra cuenta registrada
La API SHALL permitir a cualquier usuario con sesión activa descargar el avatar de otra cuenta registrada, identificada por su `username`, si esa cuenta tiene uno subido.

#### Scenario: La otra cuenta tiene avatar subido
- **WHEN** un usuario con sesión activa solicita el avatar de una cuenta registrada que sí tiene uno subido
- **THEN** la API responde con la imagen del avatar

#### Scenario: La otra cuenta no tiene avatar subido
- **WHEN** un usuario con sesión activa solicita el avatar de una cuenta registrada que no ha subido ninguno
- **THEN** la API responde con un error de "no encontrado", sin distinguir esta situación de la de un username inexistente

#### Scenario: El username no corresponde a ninguna cuenta
- **WHEN** un usuario con sesión activa solicita el avatar de un username que no existe
- **THEN** la API responde con el mismo error de "no encontrado" que si la cuenta existiera sin avatar

### Requirement: El selector de amigos muestra username y avatar mientras se escribe
La app SHALL ofrecer, en cualquier punto donde se necesite elegir otra cuenta, un campo de búsqueda que muestre en vivo los resultados coincidentes con su avatar (o un icono genérico si la cuenta no tiene uno subido) a medida que el usuario escribe, y SHALL permitir seleccionar uno de esos resultados para completar la acción en curso. SHALL permitir excluir la propia cuenta de los resultados cuando la acción no tenga sentido sobre uno mismo.

#### Scenario: Buscar muestra resultados con avatar en vivo
- **WHEN** un usuario escribe en el campo de búsqueda del selector y existen cuentas cuyo username coincide
- **THEN** la app muestra la lista de coincidencias, cada una con su avatar (o el icono genérico si no tiene) y su username, sin necesidad de confirmar la búsqueda con una acción aparte

#### Scenario: Seleccionar un resultado completa la acción con esa cuenta
- **WHEN** un usuario selecciona uno de los resultados mostrados
- **THEN** la acción que estaba usando el selector (enviar una solicitud de amistad, invitar a compartir una ruta) queda asociada a esa cuenta

#### Scenario: Sin resultados coincidentes
- **WHEN** un usuario escribe una búsqueda que no coincide con ningún username
- **THEN** la app muestra un estado vacío explicándolo, sin bloquear la posibilidad de seguir escribiendo

#### Scenario: La propia cuenta queda excluida cuando la acción lo requiere
- **WHEN** un usuario busca en un selector configurado para excluir su propia cuenta, y su propio username coincidiría con la búsqueda
- **THEN** la app no lo incluye entre los resultados mostrados

#### Scenario: Fallo de red al buscar
- **WHEN** una búsqueda falla por no haber conexión
- **THEN** la app muestra un aviso explicándolo, sin bloquear el resto de la interfaz
