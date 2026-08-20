## MODIFIED Requirements

### Requirement: Subir una ruta local a la cuenta del usuario
La app SHALL permitir subir una ruta local completa (metadatos, puntos GPS y paradas — sin fotos) a la cuenta del usuario con sesión activa, y SHALL reflejar en el mapa del detalle, inmediatamente tras una subida con éxito, los puntos que el servidor haya devuelto para esa ruta (normalizados o, si no hubo ajuste, los mismos originales) — sin esperar a una recarga de la pantalla.

#### Scenario: Subida correcta
- **WHEN** un usuario con sesión activa pulsa "Subir a la nube" en el detalle de una ruta local
- **THEN** la ruta pasa a existir también en el servidor, y el listado la muestra como sincronizada

#### Scenario: La subida actualiza el mapa con los puntos devueltos por el servidor
- **WHEN** la subida de una ruta local se completa con éxito y el servidor devuelve puntos ajustados a la carretera para alguno de ellos
- **THEN** el mapa del detalle de esa ruta se repinta de inmediato con los puntos devueltos, sin que el usuario tenga que salir y volver a entrar en la pantalla

#### Scenario: La acción de subir no está disponible sin sesión activa
- **WHEN** un usuario sin sesión activa abre el detalle de una ruta local
- **THEN** la app no muestra ninguna acción para subirla a la nube

#### Scenario: Subir sin conexión
- **WHEN** un usuario con sesión activa pulsa "Subir a la nube" sin conexión de red
- **THEN** la app muestra un error y la ruta sigue marcada como no sincronizada, sin bloquear el resto de la app

#### Scenario: Re-subir una ruta ya sincronizada actualiza la copia existente
- **WHEN** un usuario pulsa "Subir a la nube" en una ruta que ya tenía una copia en el servidor (por ejemplo, tras editar sus notas localmente)
- **THEN** el servidor sustituye los datos existentes por los actuales de esa misma ruta, sin crear una segunda copia

#### Scenario: Una ruta con un número de puntos excesivo se rechaza con un error claro
- **WHEN** un usuario intenta subir una ruta cuyo número de puntos GPS supera el límite soportado
- **THEN** la app muestra un error explicando el motivo, sin subir una copia parcial ni colgar la interfaz
