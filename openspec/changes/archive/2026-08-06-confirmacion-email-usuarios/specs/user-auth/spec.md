## MODIFIED Requirements

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
