# favoritos-rutas Specification

## Purpose

Permite marcar/desmarcar una ruta como favorita, ligada a la cuenta del usuario (no al dispositivo), para destacarla en el listado y filtrar rápidamente las rutas que quiere volver a consultar.

## Requirements

### Requirement: Marcar o desmarcar una ruta como favorita requiere sesión activa
La app SHALL permitir marcar o desmarcar una ruta como favorita únicamente cuando hay una sesión activa — SHALL NOT mostrar ninguna acción para cambiar el estado de favorito en una ruta vista sin sesión activa.

#### Scenario: Marcar una ruta como favorita
- **WHEN** un usuario con sesión activa toca el icono de favorito de una ruta que no está marcada
- **THEN** la ruta queda marcada como favorita de forma inmediata, sin pedir confirmación

#### Scenario: Desmarcar una ruta favorita
- **WHEN** un usuario con sesión activa toca el icono de favorito de una ruta ya marcada
- **THEN** la ruta deja de estar marcada como favorita de forma inmediata, sin pedir confirmación

#### Scenario: La acción de marcar/desmarcar no está disponible sin sesión activa
- **WHEN** un usuario sin sesión activa ve el listado de rutas o el detalle de una ruta
- **THEN** la app no muestra ninguna acción táctil para cambiar el estado de favorito

### Requirement: El estado de favorito se muestra siempre, tenga o no sesión activa
El indicador visual de favorito (estrella rellena si está marcada) SHALL reflejar el dato real ya guardado en la ruta, independientemente de si hay sesión activa — SHALL NOT ocultarse solo por falta de sesión, a diferencia de la acción de cambiarlo (ver requirement anterior).

#### Scenario: Una ruta favorita se ve como tal aunque no haya sesión
- **WHEN** un usuario sin sesión activa ve una ruta que ya estaba marcada como favorita (guardada localmente de una sesión anterior)
- **THEN** el indicador de favorito se muestra relleno, aunque no se pueda tocar para cambiarlo

### Requirement: Marcar favorita una ruta local funciona sin conexión, y se sincroniza si la ruta ya está en la nube
El estado de favorito SHALL guardarse localmente de inmediato, sin necesitar conexión de red — si la ruta ya está sincronizada con la cuenta, el cambio SHALL re-subirse a la nube en segundo plano (ver capability `route-cloud-sync`, requirement de re-sincronización automática).

#### Scenario: Marcar favorita sin conexión no bloquea la acción
- **WHEN** un usuario con sesión activa marca una ruta como favorita sin conexión de red
- **THEN** el cambio queda guardado localmente de inmediato, sin ningún error ni bloqueo — la app no exige conexión para esta acción

#### Scenario: Marcar favorita una ruta puramente local (nunca subida) no dispara ninguna subida
- **WHEN** un usuario marca como favorita una ruta que nunca se ha subido a la nube
- **THEN** la ruta sigue siendo puramente local — no se dispara ninguna subida remota (la marca de favorito viaja la primera vez que el usuario suba la ruta manualmente)

### Requirement: El listado se puede filtrar para ver solo las rutas favoritas
La pantalla de listado de rutas SHALL ofrecer un filtro que, al activarse, muestra únicamente las rutas marcadas como favoritas — al desactivarse, vuelve a mostrar el listado completo.

#### Scenario: Activar el filtro oculta las rutas no favoritas
- **WHEN** un usuario activa el filtro "Solo favoritas" en el listado
- **THEN** el listado muestra únicamente las rutas marcadas como favoritas, ocultando el resto

#### Scenario: El filtro no tiene favoritas que mostrar
- **WHEN** un usuario activa el filtro "Solo favoritas" y no tiene ninguna ruta marcada como favorita
- **THEN** el listado muestra un estado vacío explicando que no hay rutas favoritas todavía, distinto del estado vacío de "sin rutas" general

#### Scenario: Desactivar el filtro restaura el listado completo
- **WHEN** un usuario desactiva el filtro "Solo favoritas" tras haberlo activado
- **THEN** el listado vuelve a mostrar todas las rutas (favoritas y no favoritas), en el mismo orden que antes de filtrar
