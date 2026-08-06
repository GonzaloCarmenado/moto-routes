# user-auth Specification

## Purpose

Permite que `apps/api` identifique de forma fiable a los usuarios que la consumen, como base para proteger cualquier endpoint que exponga datos o funcionalidad ligada a una cuenta.

## Requirements

### Requirement: Registro de usuario con email y contraseña
La API SHALL permitir crear una cuenta nueva a partir de un email y una contraseña, rechazando el registro si el email ya está en uso o si la contraseña no cumple la política mínima de complejidad.

#### Scenario: Registro correcto con datos válidos
- **WHEN** un cliente envía un email no registrado previamente y una contraseña que cumple la política mínima
- **THEN** la API crea la cuenta y responde con éxito, sin devolver la contraseña en ningún formato en la respuesta

#### Scenario: Registro rechazado por email ya existente
- **WHEN** un cliente envía un email que ya tiene una cuenta asociada
- **THEN** la API rechaza la petición con un error de conflicto, sin crear una cuenta duplicada

#### Scenario: Registro rechazado por contraseña débil
- **WHEN** un cliente envía una contraseña que no cumple la política mínima de complejidad (por ejemplo, longitud insuficiente)
- **THEN** la API rechaza la petición sin crear la cuenta, indicando el motivo

### Requirement: Login emite un token de sesión válido
La API SHALL verificar el email y la contraseña recibidos contra la cuenta registrada; si coinciden y la cuenta tiene el email verificado, SHALL emitir un token de sesión. Si las credenciales no coinciden, SHALL rechazar la petición sin revelar si el email existe o no. Si las credenciales coinciden pero la cuenta no tiene el email verificado, SHALL rechazar la petición indicando que hace falta verificar el email.

#### Scenario: Login correcto devuelve un token
- **WHEN** un cliente envía el email y la contraseña correctos de una cuenta existente con el email ya verificado
- **THEN** la API responde con éxito y un token de sesión utilizable en peticiones posteriores

#### Scenario: Login rechazado por credenciales incorrectas
- **WHEN** un cliente envía una contraseña incorrecta para un email existente, o un email que no tiene cuenta asociada
- **THEN** la API responde con el mismo tipo de error genérico en ambos casos, sin indicar cuál de los dos datos era incorrecto

#### Scenario: Login rechazado por email sin verificar
- **WHEN** un cliente envía el email y la contraseña correctos de una cuenta existente cuyo email todavía no está verificado
- **THEN** la API rechaza la petición con un error distinguible del de credenciales incorrectas, indicando que hace falta verificar el email antes de iniciar sesión

### Requirement: Los endpoints protegidos exigen un token de sesión válido
Todo endpoint que dependa de una cuenta de usuario SHALL exigir un token de sesión válido y no expirado; SHALL rechazar la petición si el token falta, está mal formado, ha expirado o su firma no es válida.

#### Scenario: Acceso concedido con un token válido
- **WHEN** un cliente hace una petición a un endpoint protegido incluyendo un token de sesión válido y no expirado
- **THEN** la API procesa la petición con normalidad

#### Scenario: Acceso denegado sin token
- **WHEN** un cliente hace una petición a un endpoint protegido sin incluir ningún token
- **THEN** la API responde con un error de autenticación (401) sin procesar la petición

#### Scenario: Acceso denegado con token expirado
- **WHEN** un cliente hace una petición a un endpoint protegido con un token cuya fecha de expiración ya ha pasado
- **THEN** la API responde con un error de autenticación (401) sin procesar la petición

#### Scenario: Acceso denegado con token de firma inválida
- **WHEN** un cliente hace una petición a un endpoint protegido con un token modificado o firmado con una clave distinta a la de la API
- **THEN** la API responde con un error de autenticación (401) sin procesar la petición
