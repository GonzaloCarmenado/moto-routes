# cockpit-manual-stops Specification

## Purpose

Permite al usuario marcar deliberadamente una parada durante la grabación de una ruta y asignarle un tipo del catálogo, distinguiéndola de las paradas detectadas automáticamente por el GPS (semáforos, tráfico), que se ignoran a efectos de esta funcionalidad.

## Requirements

### Requirement: El usuario puede marcar una parada manual durante la grabación
Durante una grabación activa, la app SHALL ofrecer un control explícito para que el usuario marque que está haciendo una parada, abriendo un modal para elegir su tipo del catálogo.

#### Scenario: Pulsar el control de marcar parada abre el modal de tipo
- **WHEN** el usuario pulsa el control de marcar parada durante una grabación activa
- **THEN** se abre un modal con los tipos de parada disponibles para elegir uno

### Requirement: Una parada manual se persiste con el tipo elegido
Al elegir un tipo en el modal, la app SHALL persistir la parada asociada a la ruta en curso junto con el tipo elegido.

#### Scenario: Elegir un tipo persiste la parada
- **WHEN** el usuario elige un tipo en el modal de parada
- **THEN** la parada queda asociada a la ruta con ese tipo, recuperable tras guardar la ruta

#### Scenario: Cerrar el modal sin elegir tipo no persiste ninguna parada
- **WHEN** el usuario cierra el modal de tipo de parada sin seleccionar ninguno
- **THEN** no se crea ninguna parada nueva para la ruta en curso

### Requirement: Las paradas detectadas automáticamente no generan parada manual
La detección automática de paradas por velocidad (GPS) SHALL seguir funcionando para su propósito actual, pero SHALL NOT abrir el modal de tipo ni persistir una parada por sí sola.

#### Scenario: Una parada detectada por GPS no abre el modal
- **WHEN** el GPS detecta que la velocidad ha caído lo suficiente como para considerarse una parada (por ejemplo, un semáforo), sin que el usuario pulse el control de marcar parada
- **THEN** no se abre ningún modal y no se crea ninguna parada asociada a la ruta
