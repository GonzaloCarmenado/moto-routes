# compartir-rutas Specification

## Purpose

Permite a un usuario invitar a otra cuenta registrada a recibir una copia independiente de una de sus rutas ya sincronizadas, mediante invitación directa por email y clonado completo al aceptar — sin enlace público ni acceso compartido en vivo a la ruta original.

## Requirements

### Requirement: Compartir una ruta requiere que esté sincronizada con la cuenta del emisor, sin ninguna foto pendiente de subir
La app SHALL mostrar la acción de compartir únicamente en una ruta que ya está sincronizada con la nube — SHALL NOT mostrarla en una ruta puramente local, porque el clonado ocurre enteramente en el servidor. Si la ruta está sincronizada pero tiene fotos añadidas localmente que todavía no se han subido a la nube, la app SHALL deshabilitar la acción de compartir en vez de permitirla — SHALL NOT compartir una ruta cuyas fotos locales no estén ya en el servidor, porque el clonado solo copia lo que el servidor ya tiene.

#### Scenario: La acción de compartir no está disponible en una ruta puramente local
- **WHEN** un usuario con sesión activa ve el detalle de una ruta que nunca se ha subido a la nube
- **THEN** la app no muestra ninguna acción para compartirla

#### Scenario: La acción de compartir está disponible en una ruta sincronizada sin fotos pendientes
- **WHEN** un usuario con sesión activa ve el detalle de una ruta ya sincronizada con la nube y sin ninguna foto pendiente de subir
- **THEN** la app muestra la acción de compartir habilitada

#### Scenario: Compartir se deshabilita mientras queda alguna foto sin subir
- **WHEN** un usuario con sesión activa ve el detalle de una ruta sincronizada que tiene alguna foto local todavía sin subir a la nube (p. ej. la subida en segundo plano no ha terminado o falló)
- **THEN** la app muestra la acción de compartir deshabilitada, con una indicación de que hay fotos subiéndose

#### Scenario: Compartir se habilita en cuanto termina de subirse la última foto pendiente
- **WHEN** la última foto pendiente de una ruta termina de subirse a la nube mientras el usuario sigue viendo su detalle
- **THEN** la app habilita la acción de compartir sin necesidad de recargar la pantalla

#### Scenario: Una foto que falló al subirse se reintenta al volver a abrir el detalle de la ruta
- **WHEN** un usuario abre el detalle de una ruta sincronizada que tiene alguna foto local sin subir todavía
- **THEN** la app reintenta la subida de esa foto en segundo plano, sin bloquear la visualización de la ruta

### Requirement: Invitar a otra cuenta por email a recibir una copia de la ruta
La app SHALL permitir a un usuario con sesión activa invitar a otra cuenta registrada, identificada por su email, a recibir una copia de una ruta suya ya sincronizada.

#### Scenario: Invitación enviada a una cuenta registrada y verificada
- **WHEN** un usuario introduce el email de una cuenta registrada y verificada distinta de la suya, y confirma compartir una ruta sincronizada
- **THEN** se crea una invitación pendiente asociada a esa cuenta, visible para el destinatario en su próxima sesión

#### Scenario: La respuesta no revela si el email pertenece a una cuenta registrada
- **WHEN** un usuario introduce un email que no corresponde a ninguna cuenta registrada y confirma compartir
- **THEN** la app responde exactamente igual que si el email sí correspondiera a una cuenta (mismo mensaje, mismo tiempo de respuesta aproximado), sin crear ninguna invitación real ni indicar de ningún modo que el email no existe

#### Scenario: No se puede invitar al propio email
- **WHEN** un usuario introduce su propio email de cuenta al intentar compartir una ruta
- **THEN** la app rechaza la acción con un mensaje explicando que no se puede compartir consigo mismo, sin crear ninguna invitación

#### Scenario: Límite de invitaciones repetidas al mismo email en poco tiempo
- **WHEN** un usuario envía invitaciones repetidas al mismo email en un intervalo corto de tiempo
- **THEN** la app rechaza las peticiones que superan el límite con un error claro, sin bloquear el resto de la app

#### Scenario: Intentar compartir sin conexión
- **WHEN** un usuario con sesión activa intenta enviar una invitación sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz

### Requirement: El destinatario ve sus invitaciones recibidas pendientes
La app SHALL mostrar a un usuario con sesión activa la lista de invitaciones pendientes recibidas, incluyendo un resumen suficiente de la ruta (al menos nombre y fecha) para decidir sin necesitar aceptarla primero. La app SHALL mostrar también el número de invitaciones pendientes recibidas fuera de esa pantalla, en el acceso del listado de rutas — con "9+" cuando el número supere 9, para no romper el tamaño del icono.

#### Scenario: Lista de invitaciones pendientes con datos suficientes para decidir
- **WHEN** un usuario con sesión activa abre la pantalla de invitaciones recibidas y tiene invitaciones pendientes
- **THEN** la app muestra cada invitación con al menos el nombre/fecha de la ruta y quién la comparte

#### Scenario: Sin invitaciones pendientes
- **WHEN** un usuario con sesión activa abre la pantalla de invitaciones recibidas y no tiene ninguna pendiente
- **THEN** la app muestra un estado vacío explicándolo

#### Scenario: El acceso a invitaciones muestra el número real de pendientes
- **WHEN** un usuario con sesión activa tiene, por ejemplo, 3 invitaciones pendientes recibidas
- **THEN** el botón de acceso a invitaciones en el listado de rutas muestra el número 3, no solo un indicador de color

#### Scenario: Más de 9 invitaciones pendientes se muestran como "9+"
- **WHEN** un usuario con sesión activa tiene más de 9 invitaciones pendientes recibidas
- **THEN** el botón de acceso a invitaciones muestra "9+" en vez del número exacto

#### Scenario: Sin invitaciones pendientes, el botón no muestra ningún número
- **WHEN** un usuario con sesión activa no tiene ninguna invitación pendiente recibida
- **THEN** el botón de acceso a invitaciones no muestra ningún badge numérico

### Requirement: Aceptar una invitación clona la ruta completa como una ruta nueva e independiente
Al aceptar una invitación pendiente, la app SHALL crear en la cuenta del destinatario una copia completa e independiente de la ruta (metadatos, puntos GPS, paradas y fotos) — SHALL NOT crear ningún vínculo posterior entre la copia y la ruta original: modificar una no afecta a la otra.

#### Scenario: Aceptar clona metadatos, puntos, paradas y fotos
- **WHEN** un usuario con sesión activa acepta una invitación pendiente
- **THEN** aparece en su cuenta una ruta nueva con los mismos metadatos, puntos GPS, paradas y fotos que la ruta original, con un identificador propio distinto

#### Scenario: La ruta clonada no hereda el estado de favorito del emisor
- **WHEN** una ruta compartida estaba marcada como favorita en la cuenta del emisor
- **THEN** la copia creada en la cuenta del destinatario no está marcada como favorita

#### Scenario: Aceptar una invitación ya revocada o inexistente
- **WHEN** un usuario intenta aceptar una invitación que el emisor ya revocó, o que ya no existe
- **THEN** la app muestra un error explicándolo, sin clonar nada

#### Scenario: Aceptar sin conexión
- **WHEN** un usuario con sesión activa intenta aceptar una invitación sin conexión de red
- **THEN** la app muestra un error explicándolo, sin bloquear el resto de la interfaz, y la invitación sigue pendiente para reintentarlo

### Requirement: Rechazar una invitación no clona nada
La app SHALL permitir al destinatario rechazar una invitación pendiente, sin clonar ningún dato — la invitación queda marcada como rechazada.

#### Scenario: Rechazar una invitación pendiente
- **WHEN** un usuario con sesión activa rechaza una invitación pendiente
- **THEN** la invitación pasa a estado rechazada, no se crea ninguna ruta nueva en su cuenta, y la invitación desaparece de su lista de pendientes

### Requirement: El emisor ve el estado de sus invitaciones enviadas y puede revocar una pendiente
La app SHALL mostrar al emisor el estado de cada invitación que ha enviado (pendiente, aceptada, rechazada o revocada) y SHALL permitirle revocar una que siga pendiente.

#### Scenario: Lista de invitaciones enviadas con su estado
- **WHEN** un usuario con sesión activa abre la pantalla de invitaciones enviadas
- **THEN** ve cada invitación que ha enviado junto con su estado actual

#### Scenario: Revocar una invitación pendiente
- **WHEN** un usuario revoca una invitación que él mismo envió y que sigue pendiente
- **THEN** la invitación pasa a estado revocada y el destinatario ya no puede aceptarla

#### Scenario: No se puede revocar una invitación ya aceptada o rechazada
- **WHEN** un usuario intenta revocar una invitación que ya fue aceptada o rechazada
- **THEN** la app rechaza la acción con un mensaje explicándolo, sin cambiar el estado de la invitación

### Requirement: Una invitación solo puede ser gestionada por sus dos partes legítimas
La app SHALL rechazar cualquier intento de aceptar, rechazar o revocar una invitación por parte de una cuenta que no sea su destinatario (para aceptar/rechazar) o su emisor (para revocar) — SHALL NOT revelar si la invitación existe a una cuenta ajena a ella.

#### Scenario: Una cuenta ajena intenta aceptar o rechazar una invitación que no es suya
- **WHEN** una cuenta con sesión activa intenta aceptar o rechazar una invitación de la que no es destinataria
- **THEN** la petición se rechaza sin clonar nada ni cambiar el estado de la invitación, con el mismo resultado que si la invitación no existiera

#### Scenario: Una cuenta ajena intenta revocar una invitación que no envió
- **WHEN** una cuenta con sesión activa intenta revocar una invitación que no envió ella misma
- **THEN** la petición se rechaza sin cambiar el estado de la invitación, con el mismo resultado que si la invitación no existiera
