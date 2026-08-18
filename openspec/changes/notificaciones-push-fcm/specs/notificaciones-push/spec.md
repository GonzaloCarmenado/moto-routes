## Purpose

Aviso push del sistema operativo cuando ocurre un evento relevante para el usuario, entregado con la app en cualquier estado (abierta, en segundo plano o cerrada) — el primer evento cubierto es recibir una invitación de ruta compartida; el mecanismo de registro y envío queda genérico para futuros tipos de evento.

## ADDED Requirements

### Requirement: Registrar el token de notificaciones al iniciar sesión
La app SHALL solicitar el permiso de notificaciones del sistema y registrar el token de dispositivo contra el backend tras un inicio de sesión con éxito — SHALL NOT solicitarlo al abrir la app sin sesión activa.

#### Scenario: Login con éxito solicita el permiso si no se ha concedido antes
- **WHEN** un usuario inicia sesión con éxito y el permiso de notificaciones no está concedido todavía
- **THEN** la app solicita el permiso de notificaciones del sistema

#### Scenario: Permiso concedido registra el token contra el backend
- **WHEN** un usuario concede el permiso de notificaciones (o ya lo tenía concedido) tras iniciar sesión
- **THEN** la app registra el token de notificaciones del dispositivo contra la cuenta del usuario

#### Scenario: Permiso denegado no bloquea el resto de la app
- **WHEN** un usuario deniega el permiso de notificaciones tras iniciar sesión
- **THEN** el inicio de sesión se completa con normalidad y el resto de la app sigue funcionando igual, sin reintentar la solicitud del permiso en cada apertura

#### Scenario: Sin sesión activa, la app no solicita el permiso
- **WHEN** un usuario abre la app sin sesión activa
- **THEN** la app no solicita el permiso de notificaciones

### Requirement: Enviar una notificación push al crear una invitación de ruta compartida
Al crearse con éxito una invitación de ruta compartida (`compartir-rutas`), el sistema SHALL intentar enviar una notificación push al destinatario si tiene al menos un dispositivo con token registrado — de forma best-effort, sin bloquear ni afectar la creación de la invitación si el envío falla.

#### Scenario: El destinatario con token registrado recibe una notificación push
- **WHEN** se crea con éxito una invitación de ruta compartida y el destinatario tiene un dispositivo con token registrado
- **THEN** el sistema envía una notificación push a ese dispositivo — verificación de que el backend intenta el envío es automatizable; la recepción real en el dispositivo es **verificación manual** (no automatizable en CI, sin Google Play Services)

#### Scenario: El destinatario sin token registrado no rompe la creación de la invitación
- **WHEN** se crea con éxito una invitación de ruta compartida y el destinatario no tiene ningún dispositivo con token registrado
- **THEN** la invitación se crea con normalidad, sin ningún intento de envío

#### Scenario: Un fallo en el envío del push no afecta a la invitación ya creada
- **WHEN** el envío de la notificación push falla (servicio de push no disponible, token inválido u otro error)
- **THEN** la invitación permanece creada con normalidad y el emisor no ve ningún error relacionado con el push

### Requirement: El contenido de la notificación no revela datos a Firebase
La notificación push enviada SHALL contener únicamente un identificador de tipo de evento y los IDs mínimos necesarios — SHALL NOT incluir el nombre de la ruta, el email del emisor ni ningún otro dato personal en el payload transportado por el servicio de push.

#### Scenario: El payload transportado es opaco
- **WHEN** el sistema envía una notificación push de una invitación de ruta compartida
- **THEN** el payload enviado al servicio de push no contiene el nombre de la ruta ni el email de ninguna de las dos cuentas implicadas

### Requirement: Tocar la notificación abre la app directamente en Invitaciones
Al tocar una notificación push de invitación de ruta compartida, la app SHALL abrirse (o pasar a primer plano si ya estaba en segundo plano) directamente en la pantalla de invitaciones recibidas.

#### Scenario: Tocar la notificación con la app cerrada
- **WHEN** un usuario toca la notificación de una invitación con la app completamente cerrada
- **THEN** la app arranca y muestra directamente la pantalla de invitaciones recibidas
- **Verificación manual** (no automatizable en CI, sin Google Play Services ni push real)

#### Scenario: Tocar la notificación con la app en segundo plano
- **WHEN** un usuario toca la notificación de una invitación con la app en segundo plano
- **THEN** la app pasa a primer plano y muestra directamente la pantalla de invitaciones recibidas
- **Verificación manual** (no automatizable en CI, sin Google Play Services ni push real)
