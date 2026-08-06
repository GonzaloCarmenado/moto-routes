## Purpose

Permite crear una cuenta, iniciar sesión, recuperar una contraseña olvidada y cerrar sesión desde `apps/mobile`, sin exigir sesión para usar el resto de la app todavía.

## ADDED Requirements

### Requirement: La pantalla Perfil muestra el estado de sesión
La pantalla Perfil SHALL mostrar, sin sesión activa, acciones para iniciar sesión o crear una cuenta; con sesión activa, SHALL mostrar el email de la cuenta y una acción para cerrar sesión.

#### Scenario: Sin sesión guardada
- **WHEN** el usuario abre Perfil sin ninguna sesión guardada localmente
- **THEN** la app muestra los botones "Iniciar sesión" y "Crear cuenta"

#### Scenario: Con sesión guardada y válida
- **WHEN** el usuario abre Perfil con una sesión guardada localmente cuyo token sigue siendo válido
- **THEN** la app muestra el email de la cuenta y un botón "Cerrar sesión", sin pedir credenciales de nuevo

#### Scenario: Con sesión guardada pero ya no válida
- **WHEN** el usuario abre Perfil con una sesión guardada localmente cuyo token el servidor ya no acepta
- **THEN** la app borra la sesión guardada y muestra el mismo estado que sin sesión, sin mostrar el email obsoleto

### Requirement: Crear cuenta
La app SHALL permitir crear una cuenta nueva con email y contraseña, sin iniciar sesión automáticamente tras el registro.

#### Scenario: Registro correcto
- **WHEN** el usuario envía un email no registrado y una contraseña que cumple la política mínima
- **THEN** la app muestra un mensaje indicando que se ha enviado un email de verificación, sin guardar ninguna sesión

#### Scenario: Registro rechazado por email ya existente
- **WHEN** el usuario envía un email que ya tiene una cuenta asociada
- **THEN** la app muestra un error indicándolo, sin cerrar el diálogo

#### Scenario: Registro rechazado por contraseña débil
- **WHEN** el usuario envía una contraseña que no cumple la política mínima
- **THEN** la app muestra un error indicándolo, sin cerrar el diálogo

### Requirement: Iniciar sesión
La app SHALL permitir iniciar sesión con email y contraseña, guardando la sesión localmente si son correctos.

#### Scenario: Login correcto
- **WHEN** el usuario envía el email y la contraseña correctos de una cuenta con el email verificado
- **THEN** la app guarda la sesión localmente, cierra el diálogo, y Perfil pasa a mostrar el estado "con sesión"

#### Scenario: Login rechazado por credenciales incorrectas
- **WHEN** el usuario envía una contraseña incorrecta o un email sin cuenta asociada
- **THEN** la app muestra el mismo mensaje de error genérico en ambos casos, sin guardar ninguna sesión

#### Scenario: Login rechazado por email sin verificar
- **WHEN** el usuario envía las credenciales correctas de una cuenta cuyo email no está verificado
- **THEN** la app muestra un mensaje distinto del de credenciales incorrectas, con una acción para reenviar el email de verificación

#### Scenario: Reenviar verificación desde el error de login
- **WHEN** el usuario pulsa "Reenviar email de verificación" tras un login rechazado por email sin verificar
- **THEN** la app solicita el reenvío y muestra confirmación, sin cerrar el diálogo de login ni intentar iniciar sesión de nuevo automáticamente

### Requirement: Recuperar contraseña
La app SHALL permitir solicitar un email de recuperación de contraseña indicando solo el email, mostrando siempre el mismo resultado exista o no la cuenta.

#### Scenario: Solicitud de recuperación
- **WHEN** el usuario envía cualquier email desde el diálogo de recuperación de contraseña
- **THEN** la app muestra el mismo mensaje genérico de confirmación, sin indicar si la cuenta existe

### Requirement: Cerrar sesión
La app SHALL permitir cerrar la sesión activa, borrando la sesión guardada localmente sin ninguna llamada a `apps/api`.

#### Scenario: Cerrar sesión
- **WHEN** el usuario con sesión activa pulsa "Cerrar sesión"
- **THEN** la app borra la sesión guardada localmente y Perfil vuelve al estado "sin sesión"

### Requirement: El resto de la app funciona igual con o sin sesión
Ninguna pantalla existente (cockpit, listado de rutas, detalle de ruta, el resto de Perfil) SHALL exigir una sesión activa para funcionar.

#### Scenario: Cockpit funciona sin sesión activa
- **WHEN** un usuario sin sesión activa graba y guarda una ruta desde el cockpit
- **THEN** la ruta se guarda con normalidad, igual que antes de este cambio
