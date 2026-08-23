## MODIFIED Requirements

### Requirement: Enviar una solicitud de amistad por nombre de usuario
La app SHALL permitir a un usuario con sesión activa enviar una solicitud de amistad a otra cuenta registrada, identificada por su `username`, eligiéndola con el selector de búsqueda (ver `selector-amigos`) en vez de escribiendo un username exacto de memoria.

#### Scenario: Solicitud enviada a una cuenta existente
- **WHEN** un usuario elige, con el selector de búsqueda, el username de una cuenta registrada distinta de la suya, sin amistad ni solicitud pendiente previa entre ambos, y confirma enviar
- **THEN** se crea una solicitud pendiente asociada a esa cuenta, visible para el destinatario en su próxima sesión

#### Scenario: La respuesta no revela si el username pertenece a una cuenta registrada
- **WHEN** un usuario introduce un username que no corresponde a ninguna cuenta registrada y confirma enviar
- **THEN** la app responde exactamente igual que si el username sí correspondiera a una cuenta (mismo mensaje, mismo tiempo de respuesta aproximado), sin crear ninguna solicitud real ni indicar de ningún modo que el username no existe

#### Scenario: No se puede enviar una solicitud al propio username
- **WHEN** un usuario busca en el selector para enviar una solicitud de amistad
- **THEN** su propia cuenta nunca aparece entre los resultados, y si de todos modos se confirma su propio username la app rechaza la acción sin crear ninguna solicitud

#### Scenario: Ya existe amistad o solicitud pendiente en cualquier dirección
- **WHEN** un usuario intenta enviar una solicitud a una cuenta con la que ya es amigo, o con la que ya existe una solicitud pendiente (enviada por él o recibida de ella)
- **THEN** la app responde con el mismo mensaje genérico que un envío correcto, sin crear ninguna solicitud nueva ni duplicar la relación existente

#### Scenario: Límite de solicitudes repetidas al mismo username en poco tiempo
- **WHEN** un usuario envía solicitudes repetidas al mismo username en un intervalo corto de tiempo
- **THEN** la app rechaza las peticiones que superan el límite con un error claro, sin bloquear el resto de la app

#### Scenario: Enviar una solicitud sin conexión
- **WHEN** un usuario con sesión activa intenta enviar una solicitud de amistad sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz
