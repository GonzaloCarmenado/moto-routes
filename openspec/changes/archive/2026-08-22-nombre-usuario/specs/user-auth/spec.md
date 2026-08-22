## MODIFIED Requirements

### Requirement: Registro de usuario con email y contraseña
La API SHALL permitir crear una cuenta nueva a partir de un email, una contraseña y un nombre de usuario, rechazando el registro si el email ya está en uso, si la contraseña no cumple la política mínima de complejidad, si el nombre de usuario ya está en uso (sin distinguir mayúsculas de minúsculas) o si no cumple el formato permitido (letras, dígitos y guion bajo, entre 3 y 20 caracteres).

#### Scenario: Registro correcto con datos válidos
- **WHEN** un cliente envía un email no registrado previamente, una contraseña que cumple la política mínima y un nombre de usuario disponible con formato válido
- **THEN** la API crea la cuenta con ese nombre de usuario y responde con éxito, sin devolver la contraseña en ningún formato en la respuesta

#### Scenario: Registro rechazado por email ya existente
- **WHEN** un cliente envía un email que ya tiene una cuenta asociada
- **THEN** la API rechaza la petición con un error de conflicto, sin crear una cuenta duplicada

#### Scenario: Registro rechazado por contraseña débil
- **WHEN** un cliente envía una contraseña que no cumple la política mínima de complejidad (por ejemplo, longitud insuficiente)
- **THEN** la API rechaza la petición sin crear la cuenta, indicando el motivo

#### Scenario: Registro rechazado por nombre de usuario ya en uso
- **WHEN** un cliente envía un nombre de usuario que ya tiene otra cuenta, sin importar mayúsculas/minúsculas
- **THEN** la API rechaza la petición con un error de conflicto indicando el motivo, sin crear una cuenta duplicada

#### Scenario: Registro rechazado por formato de nombre de usuario inválido
- **WHEN** un cliente envía un nombre de usuario que no cumple el formato permitido (por ejemplo, demasiado corto, demasiado largo, o con caracteres no permitidos)
- **THEN** la API rechaza la petición sin crear la cuenta, indicando el motivo

## ADDED Requirements

### Requirement: Una cuenta existente sin nombre de usuario queda bloqueada hasta fijarlo
La app SHALL bloquear el acceso al resto de la app (mostrando únicamente una pantalla dedicada para fijar el nombre de usuario) cuando una cuenta con sesión activa todavía no tiene ninguno — nunca deja pasar a una cuenta sin username, ni siquiera temporalmente. Una vez fijado con éxito, SHALL restaurar el acceso normal a la app sin exigir un nuevo login.

#### Scenario: Iniciar sesión en una cuenta sin username muestra la pantalla de bloqueo
- **WHEN** un usuario inicia sesión (o abre la app con una sesión ya guardada) en una cuenta que todavía no tiene nombre de usuario
- **THEN** la app muestra únicamente la pantalla para fijar el nombre de usuario, sin acceso al resto de la app

#### Scenario: Fijar un nombre de usuario válido y disponible restaura el acceso
- **WHEN** un usuario en la pantalla de bloqueo envía un nombre de usuario disponible con formato válido
- **THEN** la cuenta queda con ese nombre de usuario, y la app da paso con normalidad al resto de la app sin pedir un nuevo login

#### Scenario: Intentar fijar un nombre de usuario ya en uso mantiene el bloqueo
- **WHEN** un usuario en la pantalla de bloqueo envía un nombre de usuario que ya tiene otra cuenta
- **THEN** la app muestra un error explicándolo y permanece en la pantalla de bloqueo, sin dar acceso al resto de la app

#### Scenario: Una cuenta recién registrada nunca ve la pantalla de bloqueo
- **WHEN** un usuario inicia sesión justo después de registrarse (con nombre de usuario ya fijado en el registro)
- **THEN** la app entra directamente al resto de la app, sin mostrar la pantalla de fijar nombre de usuario

### Requirement: El nombre de usuario se puede editar después de fijado
La app SHALL permitir a un usuario con sesión activa y nombre de usuario ya fijado cambiarlo por otro, desde su perfil — sujeto a las mismas reglas de unicidad y formato que al registrarse o al fijarlo por primera vez, y sin permitir dejarlo vacío.

#### Scenario: Editar el nombre de usuario por otro disponible
- **WHEN** un usuario con sesión activa cambia su nombre de usuario por otro disponible con formato válido, desde su perfil
- **THEN** la cuenta queda con el nuevo nombre de usuario, reflejado de inmediato en el perfil

#### Scenario: Editar el nombre de usuario rechazado por estar ya en uso
- **WHEN** un usuario con sesión activa intenta cambiar su nombre de usuario por uno que ya tiene otra cuenta
- **THEN** la app muestra un error explicándolo y el nombre de usuario de la cuenta no cambia

#### Scenario: No se puede dejar el nombre de usuario vacío
- **WHEN** un usuario con sesión activa intenta guardar un nombre de usuario vacío desde su perfil
- **THEN** la app rechaza la acción sin llamar al servidor, sin cambiar el nombre de usuario actual
