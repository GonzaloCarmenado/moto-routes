## Purpose

Permite a un usuario construir una lista persistente de contactos dentro de la app enviando y aceptando solicitudes de amistad identificadas por nombre de usuario, sin necesitar conocer el email de la otra cuenta.

## ADDED Requirements

### Requirement: Enviar una solicitud de amistad por nombre de usuario
La app SHALL permitir a un usuario con sesión activa enviar una solicitud de amistad a otra cuenta registrada, identificada por su `username`.

#### Scenario: Solicitud enviada a una cuenta existente
- **WHEN** un usuario introduce el username de una cuenta registrada distinta de la suya, sin amistad ni solicitud pendiente previa entre ambos, y confirma enviar
- **THEN** se crea una solicitud pendiente asociada a esa cuenta, visible para el destinatario en su próxima sesión

#### Scenario: La respuesta no revela si el username pertenece a una cuenta registrada
- **WHEN** un usuario introduce un username que no corresponde a ninguna cuenta registrada y confirma enviar
- **THEN** la app responde exactamente igual que si el username sí correspondiera a una cuenta (mismo mensaje, mismo tiempo de respuesta aproximado), sin crear ninguna solicitud real ni indicar de ningún modo que el username no existe

#### Scenario: No se puede enviar una solicitud al propio username
- **WHEN** un usuario introduce su propio username al intentar enviar una solicitud
- **THEN** la app rechaza la acción con un mensaje explicando que no se puede uno enviar una solicitud a sí mismo, sin crear ninguna solicitud

#### Scenario: Ya existe amistad o solicitud pendiente en cualquier dirección
- **WHEN** un usuario intenta enviar una solicitud a una cuenta con la que ya es amigo, o con la que ya existe una solicitud pendiente (enviada por él o recibida de ella)
- **THEN** la app responde con el mismo mensaje genérico que un envío correcto, sin crear ninguna solicitud nueva ni duplicar la relación existente

#### Scenario: Límite de solicitudes repetidas al mismo username en poco tiempo
- **WHEN** un usuario envía solicitudes repetidas al mismo username en un intervalo corto de tiempo
- **THEN** la app rechaza las peticiones que superan el límite con un error claro, sin bloquear el resto de la app

#### Scenario: Enviar una solicitud sin conexión
- **WHEN** un usuario con sesión activa intenta enviar una solicitud de amistad sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz

### Requirement: El destinatario ve sus solicitudes de amistad pendientes recibidas
La app SHALL mostrar a un usuario con sesión activa la lista de solicitudes de amistad pendientes recibidas, con al menos el username de quien la envía. La app SHALL mostrar también el número de solicitudes pendientes recibidas en el punto de acceso a la pantalla, con "9+" cuando el número supere 9.

#### Scenario: Lista de solicitudes pendientes con el username del emisor
- **WHEN** un usuario con sesión activa abre la pantalla de solicitudes de amistad y tiene alguna pendiente
- **THEN** la app muestra cada solicitud con el username de quien la envió

#### Scenario: Sin solicitudes pendientes
- **WHEN** un usuario con sesión activa abre la pantalla de solicitudes de amistad y no tiene ninguna pendiente
- **THEN** la app muestra un estado vacío explicándolo

#### Scenario: El acceso a solicitudes muestra el número real de pendientes
- **WHEN** un usuario con sesión activa tiene, por ejemplo, 3 solicitudes de amistad pendientes recibidas
- **THEN** el punto de acceso a solicitudes desde Perfil muestra el número 3, no solo un indicador de color

#### Scenario: Más de 9 solicitudes pendientes se muestran como "9+"
- **WHEN** un usuario con sesión activa tiene más de 9 solicitudes pendientes recibidas
- **THEN** el punto de acceso muestra "9+" en vez del número exacto

#### Scenario: Sin solicitudes pendientes, el punto de acceso no muestra ningún número
- **WHEN** un usuario con sesión activa no tiene ninguna solicitud pendiente recibida
- **THEN** el punto de acceso a solicitudes no muestra ningún badge numérico

### Requirement: Aceptar una solicitud crea una amistad mutua e inmediata
Al aceptar una solicitud pendiente, la app SHALL crear una relación de amistad visible en el listado de ambas cuentas — SHALL NOT requerir ninguna confirmación adicional por parte del emisor original.

#### Scenario: Aceptar crea la amistad para ambas cuentas
- **WHEN** un usuario con sesión activa acepta una solicitud de amistad pendiente
- **THEN** la otra cuenta aparece en su propio listado de amigos, y la cuenta que aceptó aparece igualmente en el listado de amigos de quien envió la solicitud original

#### Scenario: Aceptar una solicitud ya revocada o inexistente
- **WHEN** un usuario intenta aceptar una solicitud que el emisor ya revocó, o que ya no existe
- **THEN** la app muestra un error explicándolo, sin crear ninguna amistad

#### Scenario: Aceptar sin conexión
- **WHEN** un usuario con sesión activa intenta aceptar una solicitud sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz, y la solicitud sigue pendiente para reintentarlo

### Requirement: Rechazar una solicitud no crea ninguna amistad
La app SHALL permitir al destinatario rechazar una solicitud de amistad pendiente, sin crear ninguna relación — la solicitud queda marcada como rechazada.

#### Scenario: Rechazar una solicitud pendiente
- **WHEN** un usuario con sesión activa rechaza una solicitud de amistad pendiente
- **THEN** la solicitud pasa a estado rechazada, no se crea ninguna amistad, y la solicitud desaparece de su lista de pendientes

### Requirement: El emisor puede revocar una solicitud pendiente
La app SHALL permitir al emisor de una solicitud revocarla mientras siga pendiente.

#### Scenario: Revocar una solicitud pendiente
- **WHEN** un usuario revoca una solicitud de amistad que él mismo envió y que sigue pendiente
- **THEN** la solicitud pasa a estado revocada y el destinatario ya no puede aceptarla

#### Scenario: No se puede revocar una solicitud ya aceptada o rechazada
- **WHEN** un usuario intenta revocar una solicitud que ya fue aceptada o rechazada
- **THEN** la app rechaza la acción con un mensaje explicándolo, sin cambiar el estado de la solicitud

### Requirement: Una solicitud solo puede ser gestionada por sus dos partes legítimas
La app SHALL rechazar cualquier intento de aceptar, rechazar o revocar una solicitud por parte de una cuenta que no sea su destinatario (para aceptar/rechazar) o su emisor (para revocar) — SHALL NOT revelar si la solicitud existe a una cuenta ajena a ella.

#### Scenario: Una cuenta ajena intenta aceptar o rechazar una solicitud que no es suya
- **WHEN** una cuenta con sesión activa intenta aceptar o rechazar una solicitud de la que no es destinataria
- **THEN** la petición se rechaza sin crear ninguna amistad ni cambiar el estado de la solicitud, con el mismo resultado que si la solicitud no existiera

#### Scenario: Una cuenta ajena intenta revocar una solicitud que no envió
- **WHEN** una cuenta con sesión activa intenta revocar una solicitud que no envió ella misma
- **THEN** la petición se rechaza sin cambiar el estado de la solicitud, con el mismo resultado que si la solicitud no existiera

### Requirement: Listado de amigos aceptados
La app SHALL mostrar a un usuario con sesión activa la lista de sus amigos (solicitudes ya aceptadas en cualquiera de las dos direcciones), identificados por username.

#### Scenario: Lista de amigos con al menos un amigo
- **WHEN** un usuario con sesión activa abre su listado de amigos y tiene al menos uno
- **THEN** la app muestra el username de cada amigo

#### Scenario: Sin amigos todavía
- **WHEN** un usuario con sesión activa abre su listado de amigos y no tiene ninguno
- **THEN** la app muestra un estado vacío explicándolo
