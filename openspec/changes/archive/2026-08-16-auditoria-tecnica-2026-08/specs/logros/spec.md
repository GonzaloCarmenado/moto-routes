## MODIFIED Requirements

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
