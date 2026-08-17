## MODIFIED Requirements

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
