# user-auth Specification

## Purpose

Permite que `apps/api` identifique de forma fiable a los usuarios que la consumen, como base para proteger cualquier endpoint que exponga datos o funcionalidad ligada a una cuenta.

## Requirements

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

### Requirement: La app normaliza las mayúsculas a minúsculas al escribir un nombre de usuario
La app SHALL transformar automáticamente a minúsculas cualquier letra mayúscula que el usuario escriba en el campo de nombre de usuario, tanto al fijarlo por primera vez como al editarlo — el formato solo permite minúsculas, y la app no debe rechazar la entrada ni exigir que el usuario la corrija a mano.

#### Scenario: Escribir un nombre de usuario con mayúsculas se normaliza en vivo
- **WHEN** un usuario escribe un nombre de usuario con alguna letra mayúscula, en cualquiera de los dos flujos (fijarlo por primera vez o editarlo)
- **THEN** el campo muestra el texto ya transformado a minúsculas, y al guardar se envía el nombre de usuario en minúsculas

### Requirement: Login emite un token de sesión válido
La API SHALL verificar el email y la contraseña recibidos contra la cuenta registrada; si coinciden y la cuenta tiene el email verificado, SHALL emitir un access token de sesión de vida corta junto con un refresh token de vida larga. Si las credenciales no coinciden, SHALL rechazar la petición sin revelar si el email existe o no. Si las credenciales coinciden pero la cuenta no tiene el email verificado, SHALL rechazar la petición indicando que hace falta verificar el email.

#### Scenario: Login correcto devuelve un access token y un refresh token
- **WHEN** un cliente envía el email y la contraseña correctos de una cuenta existente con el email ya verificado
- **THEN** la API responde con éxito, un access token utilizable de inmediato en peticiones posteriores, y un refresh token distinto que permite obtener un access token nuevo más adelante sin volver a enviar la contraseña

#### Scenario: Login rechazado por credenciales incorrectas
- **WHEN** un cliente envía una contraseña incorrecta para un email existente, o un email que no tiene cuenta asociada
- **THEN** la API responde con el mismo tipo de error genérico en ambos casos, sin indicar cuál de los dos datos era incorrecto, y no emite ningún token

#### Scenario: Login rechazado por email sin verificar
- **WHEN** un cliente envía el email y la contraseña correctos de una cuenta existente cuyo email todavía no está verificado
- **THEN** la API rechaza la petición con un error distinguible del de credenciales incorrectas, indicando que hace falta verificar el email antes de iniciar sesión, y no emite ningún token

### Requirement: Un refresh token vigente se puede canjear por un access token nuevo sin contraseña
La API SHALL permitir canjear un refresh token todavía vigente y no revocado por un access token nuevo, sin exigir email ni contraseña. Cada canje SHALL invalidar el refresh token usado y emitir uno nuevo en su lugar (uso único) — el cliente reemplaza el que tenía, nunca reutiliza el mismo dos veces.

#### Scenario: Canje correcto de un refresh token vigente
- **WHEN** un cliente envía un refresh token todavía vigente y no revocado
- **THEN** la API responde con éxito, un access token nuevo, y un refresh token nuevo que sustituye al usado

#### Scenario: Canje rechazado por refresh token expirado
- **WHEN** un cliente envía un refresh token cuya fecha de expiración ya ha pasado
- **THEN** la API rechaza la petición con un error de autenticación (401), sin emitir ningún token

#### Scenario: Canje rechazado por refresh token revocado o ya usado
- **WHEN** un cliente envía un refresh token que ya fue revocado (por logout) o que ya se había canjeado antes (reutilización de un token de un solo uso)
- **THEN** la API rechaza la petición con un error de autenticación (401), sin emitir ningún token

#### Scenario: Canje rechazado por refresh token inexistente o manipulado
- **WHEN** un cliente envía un valor que no corresponde a ningún refresh token emitido por la API
- **THEN** la API rechaza la petición con un error de autenticación (401), sin distinguir en la respuesta si el token nunca existió, expiró o fue revocado

#### Scenario: El endpoint de renovación tiene límite de intentos
- **WHEN** un cliente envía repetidamente refresh tokens inválidos contra el endpoint de renovación por encima del límite permitido
- **THEN** la API rechaza las peticiones adicionales con un error de límite de tasa, igual que ya ocurre en login

### Requirement: Cerrar sesión revoca el refresh token
La app SHALL revocar server-side el refresh token asociado a la sesión activa al cerrar sesión explícitamente — un refresh token revocado nunca se puede volver a canjear, ni aunque no haya expirado todavía.

#### Scenario: Cerrar sesión invalida el refresh token para futuros canjes
- **WHEN** un usuario cierra sesión desde la app, con un refresh token todavía vigente
- **THEN** la API revoca ese refresh token, y cualquier intento posterior de canjearlo es rechazado como en el escenario de "revocado o ya usado"

### Requirement: La app renueva el access token de forma silenciosa antes de forzar el logout
La app SHALL intentar renovar el access token usando el refresh token guardado, sin pedir contraseña, en dos momentos: al abrir la app con una sesión guardada, y ante cualquier respuesta 401 de un endpoint protegido durante el uso normal. Solo SHALL forzar el cierre de sesión (mostrando la pantalla de login) cuando el refresh token también resulte inválido, expirado o revocado.

#### Scenario: Abrir la app con el access token caducado renueva la sesión sin pedir contraseña
- **WHEN** un usuario abre la app con una sesión guardada cuyo access token ya ha expirado, pero el refresh token guardado sigue vigente
- **THEN** la app renueva el access token de forma silenciosa en segundo plano y da paso con normalidad al resto de la app, sin mostrar la pantalla de login

#### Scenario: Una petición rechazada por 401 se reintenta una vez tras renovar
- **WHEN** una petición a un endpoint protegido durante el uso normal de la app responde 401 y hay un refresh token guardado
- **THEN** la app intenta renovar el access token y, si lo consigue, repite la petición original una sola vez con el access token nuevo, sin que el usuario lo note

#### Scenario: Si la renovación también falla, la app pide login de nuevo
- **WHEN** la app intenta renovar el access token y el refresh token guardado también resulta inválido, expirado o revocado
- **THEN** la app limpia la sesión local por completo y muestra la pantalla de login, igual que ante un 401 confirmado hoy

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
