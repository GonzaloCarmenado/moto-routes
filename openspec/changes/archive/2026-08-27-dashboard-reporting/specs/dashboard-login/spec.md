## Purpose

Puerta de acceso de un único operador al panel web, reutilizando el secreto administrativo ya existente (`ADMIN_STATUS_TOKEN`, ver ADR-059) como credencial — sin crear cuentas de usuario ni tocar el sistema de autenticación de `apps/api`.

## ADDED Requirements

### Requirement: Autenticación con el secreto administrativo existente
La pantalla de login SHALL aceptar como credencial el mismo secreto que ya protege el endpoint de reporting. Una credencial válida SHALL abrir una sesión de operador; una credencial inválida SHALL dejar a la persona sin sesión, con un único mensaje de error genérico que no distinga "credencial incorrecta" de "casi correcta".

#### Scenario: Credencial correcta
- **WHEN** se introduce la credencial que coincide con el secreto administrativo configurado
- **THEN** se abre una sesión de operador y se concede acceso a las vistas privadas

#### Scenario: Credencial incorrecta
- **WHEN** se introduce una credencial que no coincide con el secreto administrativo configurado
- **THEN** no se abre ninguna sesión, y se muestra un único mensaje de error genérico, sin indicar en qué se diferencia de la credencial correcta

### Requirement: Sesión de operador persiste mientras dure la sesión de navegador
Una sesión de operador abierta SHALL seguir siendo válida para peticiones posteriores sin pedir la credencial de nuevo, hasta que la persona cierre sesión explícitamente o hasta que el propio navegador dé por terminada la sesión (p. ej. al cerrarlo).

#### Scenario: Navegación repetida tras iniciar sesión
- **WHEN** con una sesión de operador ya abierta se navega a distintas vistas privadas de la aplicación
- **THEN** ninguna de esas navegaciones vuelve a pedir la credencial

#### Scenario: Cierre de sesión explícito
- **WHEN** la persona con sesión abierta pulsa la acción de cerrar sesión
- **THEN** la sesión deja de ser válida y cualquier ruta privada solicitada a partir de ese momento redirige a login

### Requirement: Una sesión que deja de ser válida no expone datos parciales
Si una sesión de operador deja de ser válida (cierre de sesión, expiración del lado del navegador, o el secreto configurado en el servidor cambia) mientras se está consultando una vista privada, la siguiente petición a datos del servidor SHALL redirigir a login en vez de mostrar datos parciales, obsoletos o un error sin contexto.

#### Scenario: El servidor rechaza la sesión a mitad de uso
- **WHEN** una petición a datos del servidor desde una vista privada recibe una respuesta de no autorizado
- **THEN** la aplicación invalida la sesión localmente y redirige a login
