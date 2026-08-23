## MODIFIED Requirements

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

## ADDED Requirements

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
