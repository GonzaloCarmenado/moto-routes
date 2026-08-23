## MODIFIED Requirements

### Requirement: Invitar a otra cuenta por nombre de usuario a recibir una copia de la ruta
La app SHALL permitir a un usuario con sesión activa invitar a otra cuenta registrada y con el email verificado, identificada por su `username` y elegida con el selector de búsqueda (ver `selector-amigos`), a recibir una copia de una ruta suya ya sincronizada.

#### Scenario: Invitación enviada a una cuenta registrada y verificada
- **WHEN** un usuario elige, con el selector de búsqueda, el username de una cuenta registrada y verificada distinta de la suya, y confirma compartir una ruta sincronizada
- **THEN** se crea una invitación pendiente asociada a esa cuenta, visible para el destinatario en su próxima sesión

#### Scenario: La respuesta no revela si el username pertenece a una cuenta registrada
- **WHEN** un usuario introduce un username que no corresponde a ninguna cuenta registrada y confirma compartir
- **THEN** la app responde exactamente igual que si el username sí correspondiera a una cuenta (mismo mensaje, mismo tiempo de respuesta aproximado), sin crear ninguna invitación real ni indicar de ningún modo que el username no existe

#### Scenario: No se puede invitar al propio username
- **WHEN** un usuario busca en el selector para invitar a compartir una ruta
- **THEN** su propia cuenta nunca aparece entre los resultados, y si de todos modos se confirma su propio username la app rechaza la acción explicando que no se puede compartir consigo mismo, sin crear ninguna invitación

#### Scenario: Límite de invitaciones repetidas al mismo username en poco tiempo
- **WHEN** un usuario envía invitaciones repetidas al mismo username en un intervalo corto de tiempo
- **THEN** la app rechaza las peticiones que superan el límite con un error claro, sin bloquear el resto de la app

#### Scenario: Intentar compartir sin conexión
- **WHEN** un usuario con sesión activa intenta enviar una invitación sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz

## RENAMED Requirements

- FROM: `### Requirement: Invitar a otra cuenta por email a recibir una copia de la ruta`
- TO: `### Requirement: Invitar a otra cuenta por nombre de usuario a recibir una copia de la ruta`
