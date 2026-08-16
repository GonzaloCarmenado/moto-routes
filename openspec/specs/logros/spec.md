# logros Specification

## Purpose

Reconocer hitos del progreso del usuario (kilómetros recorridos, rutas grabadas, duración de una ruta) con logros otorgados automáticamente y visibles en su cuenta, para dar un motivo de vuelta a la app más allá de la grabación en sí.

## Requirements

### Requirement: Catálogo de logros basado en datos
El sistema SHALL almacenar el catálogo de logros (título, icono, descripción breve, tipo de requisito, umbral) como datos, de forma que añadir un logro nuevo no requiera desplegar código nuevo.

#### Scenario: Añadir un logro nuevo sin desplegar código
- **WHEN** se inserta una fila nueva en el catálogo de logros
- **THEN** el sistema la incluye en la próxima comprobación de logros de cualquier usuario, sin requerir cambios de código

### Requirement: Cálculo de agregados sobre rutas sincronizadas
El sistema SHALL calcular, para cada usuario autenticado, sus agregados (kilómetros totales, número de rutas grabadas, kilómetros del mes natural en curso, duración de la ruta más larga) usando únicamente rutas ya sincronizadas con la nube — nunca rutas que solo existen en local sin sincronizar.

#### Scenario: Ruta local sin sincronizar no cuenta
- **WHEN** el usuario ha grabado una ruta que aún no ha subido a la nube
- **THEN** esa ruta no se incluye en el cálculo de kilómetros totales, kilómetros del mes ni número de rutas grabadas hasta que se sincronice

### Requirement: Otorgamiento idempotente de logros
El sistema SHALL otorgar cada logro a un usuario como máximo una vez, registrando la fecha de consecución, en el momento en que sus agregados alcanzan por primera vez el umbral del logro.

#### Scenario: Se otorga la primera vez que se cumple el umbral
- **WHEN** los agregados de un usuario alcanzan o superan el umbral de un logro que todavía no tenía otorgado
- **THEN** el sistema registra ese logro para el usuario con la fecha de la comprobación

#### Scenario: Comprobación repetida no duplica el logro
- **WHEN** el sistema comprueba los logros de un usuario que ya tiene un logro concreto otorgado
- **THEN** no se crea un registro duplicado y la fecha de consecución original no cambia

### Requirement: Comprobación de logros tras sincronización
El sistema SHALL disparar una comprobación de logros nuevos automáticamente después de que una sincronización de ruta tenga éxito en el cliente, sin requerir ninguna acción manual adicional del usuario más allá de esa sincronización.

#### Scenario: Logro nuevo tras subir una ruta
- **WHEN** una ruta se sincroniza con éxito con la nube y esa sincronización hace que el usuario supere el umbral de un logro pendiente
- **THEN** la app muestra la animación de logro desbloqueado sin acción adicional del usuario

#### Scenario: Sin logros nuevos
- **WHEN** una ruta se sincroniza con éxito y ningún logro pendiente se cumple todavía
- **THEN** no se muestra ninguna animación

#### Scenario: Fallo al comprobar logros no bloquea la sincronización
- **WHEN** la sincronización de la ruta tiene éxito pero la comprobación de logros nuevos falla (p. ej. sin conexión momentánea justo después)
- **THEN** la ruta queda igualmente sincronizada y el usuario no ve ningún error bloqueante; los logros pendientes de reconocer se detectan en la siguiente comprobación

### Requirement: Persistencia permanente del logro otorgado
Una vez otorgado, un logro SHALL permanecer otorgado aunque después se borren las rutas que contribuyeron a alcanzar su requisito.

#### Scenario: Borrar una ruta no revoca un logro ya conseguido
- **WHEN** el usuario borra una ruta que había contribuido a alcanzar un logro ya otorgado
- **THEN** ese logro sigue apareciendo como conseguido con su fecha original

### Requirement: Animación de logro desbloqueado
Cuando se otorga uno o varios logros nuevos tras una sincronización, el sistema SHALL mostrar una animación de atención completa por logro (título, descripción, icono), en cola secuencial si se desbloquea más de uno a la vez. Mientras la animación está visible, SHALL atrapar el foco de teclado dentro del overlay y SHALL cerrarse al pulsar Escape, con el mismo criterio que el resto de overlays modales de la app.

#### Scenario: Un único logro desbloqueado
- **WHEN** se desbloquea un solo logro tras sincronizar
- **THEN** se muestra una animación con su título, descripción e icono

#### Scenario: Varios logros a la vez
- **WHEN** se desbloquean varios logros en la misma comprobación
- **THEN** se muestran en cola, una animación completa tras otra, sin solaparse

#### Scenario: Accesibilidad de movimiento reducido
- **WHEN** el usuario tiene activada la preferencia de sistema de movimiento reducido
- **THEN** la animación de desbloqueo respeta esa preferencia (sin movimiento no esencial), mostrando igualmente el título, la descripción e icono del logro

#### Scenario: Cierre por teclado (Escape)
- **WHEN** el usuario pulsa Escape mientras la animación de un logro está visible
- **THEN** el overlay se cierra, igual que si se hubiera pulsado el botón "Continuar", y pasa al siguiente logro en cola si lo hay

#### Scenario: Foco atrapado dentro del overlay
- **WHEN** el usuario navega con Tab mientras la animación está visible
- **THEN** el foco nunca sale del overlay (Tab desde el último elemento enfocable vuelve al primero, y viceversa con Shift+Tab)

### Requirement: Pantalla "Mis logros"
El sistema SHALL ofrecer una pantalla, accesible desde la cuenta del usuario, que liste los logros conseguidos (con la fecha en que se consiguieron) y los logros pendientes (con el progreso actual frente a su umbral).

#### Scenario: Ver logros conseguidos
- **WHEN** el usuario abre "Mis logros" con sesión activa
- **THEN** ve los logros ya conseguidos junto a la fecha en que se consiguieron

#### Scenario: Ver progreso de logros pendientes
- **WHEN** el usuario abre "Mis logros" con sesión activa
- **THEN** ve los logros pendientes junto a su progreso actual frente al umbral requerido (p. ej. "320/500 km")

#### Scenario: Sin sesión activa
- **WHEN** el usuario intenta abrir "Mis logros" sin sesión activa
- **THEN** el sistema no realiza ninguna petición al backend y muestra un aviso indicando que hace falta iniciar sesión para ver los logros

#### Scenario: Cuenta sin ninguna ruta sincronizada
- **WHEN** un usuario con sesión activa no tiene ninguna ruta sincronizada todavía
- **THEN** todos los logros aparecen como pendientes con progreso en cero, sin error

### Requirement: Ventana mensual de mes natural
El tipo de requisito de kilómetros del mes SHALL evaluarse sobre el mes natural en curso (del día 1 al último día del mes), nunca sobre una ventana móvil de días.

#### Scenario: Kilómetros del mes se reinician cada mes natural
- **WHEN** cambia el mes natural
- **THEN** el progreso mostrado para un logro de kilómetros del mes vuelve a contar desde cero para el mes nuevo, sin tener en cuenta kilómetros de meses anteriores

#### Scenario: Logro mensual ya otorgado no se pierde al cambiar de mes
- **WHEN** un usuario ya consiguió un logro de kilómetros del mes en un mes anterior
- **THEN** ese logro sigue apareciendo como conseguido en meses posteriores, independientemente del progreso del mes en curso

### Requirement: Logro de ruta larga por duración
El sistema SHALL soportar un tipo de logro que se cumple con una única ruta sincronizada cuya duración supere un umbral configurado, no por acumulación de duración entre varias rutas.

#### Scenario: Una sola ruta larga desbloquea el logro
- **WHEN** el usuario sincroniza una ruta cuya duración supera el umbral configurado del logro
- **THEN** el logro se otorga aunque ninguna ruta anterior lo hubiera alcanzado

#### Scenario: Varias rutas cortas no lo desbloquean
- **WHEN** el usuario tiene varias rutas sincronizadas cuya suma de duración supera el umbral pero ninguna individualmente lo supera
- **THEN** el logro de ruta larga no se otorga
