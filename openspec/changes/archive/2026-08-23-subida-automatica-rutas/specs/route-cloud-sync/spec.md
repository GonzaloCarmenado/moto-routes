## MODIFIED Requirements

### Requirement: Subir una ruta local a la cuenta del usuario
La app SHALL permitir subir una ruta local completa (metadatos, puntos GPS y paradas — sin fotos) a la cuenta del usuario con sesión activa, y SHALL reflejar en el mapa del detalle, inmediatamente tras una subida con éxito, los puntos que el servidor haya devuelto para esa ruta (normalizados o, si no hubo ajuste, los mismos originales) — sin esperar a una recarga de la pantalla. Además de la acción manual "Subir a la nube" del detalle, la app SHALL intentar subir automáticamente, sin ninguna acción del usuario, cualquier ruta recién grabada y guardada mientras haya sesión activa — un fallo de esa subida automática SHALL NOT reintentarse solo; el usuario puede reintentar en cualquier momento con la acción manual, que sigue disponible sin cambios tanto para una ruta que nunca se subió como para forzar la re-subida de una ya sincronizada.

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

#### Scenario: Guardar una ruta recién grabada con sesión activa la sube sola
- **WHEN** un usuario con sesión activa termina de grabar una ruta y la guarda
- **THEN** la app intenta subirla a la nube automáticamente, sin que el usuario tenga que abrir el detalle ni pulsar ningún botón

#### Scenario: Guardar sin sesión activa no intenta ninguna subida
- **WHEN** un usuario sin sesión activa termina de grabar una ruta y la guarda
- **THEN** la ruta queda guardada solo en local, sin ningún intento de subida — mismo comportamiento que si nunca hubiera existido la subida automática

#### Scenario: Un fallo en la subida automática no se reintenta solo
- **WHEN** la subida automática de una ruta recién guardada falla (sin conexión, error del servidor, límite de puntos superado)
- **THEN** la ruta permanece intacta en local, marcada como no sincronizada, sin que la app vuelva a intentarlo por su cuenta — el usuario puede reintentar cuando quiera con la acción manual "Subir a la nube"

## ADDED Requirements

### Requirement: Feedback visible mientras dura una subida automática
Mientras una subida automática de ruta (ver "Subir una ruta local a la cuenta del usuario") está en curso, la app SHALL mostrar un indicador visible en la parte superior de la pantalla que informe del progreso, y SHALL actualizarlo al terminar para reflejar si la subida tuvo éxito o falló, sin bloquear el uso del resto de la app en ningún momento. El indicador SHALL desaparecer por sí solo pasado un tiempo tras terminar, sin exigir ninguna acción del usuario para cerrarlo.

#### Scenario: El indicador aparece al empezar la subida automática
- **WHEN** empieza una subida automática de una ruta recién guardada
- **THEN** aparece un indicador en la parte superior de la app mostrando que la ruta se está subiendo

#### Scenario: El indicador refleja el éxito de la subida
- **WHEN** una subida automática en curso termina con éxito
- **THEN** el indicador cambia para mostrar que la ruta ya se ha subido, y desaparece por sí solo poco después

#### Scenario: El indicador refleja un fallo de la subida
- **WHEN** una subida automática en curso termina con un error
- **THEN** el indicador cambia para mostrar que la subida ha fallado, y desaparece por sí solo poco después

#### Scenario: El resto de la app sigue usable mientras el indicador está visible
- **WHEN** el indicador de subida está visible, en cualquiera de sus estados
- **THEN** el usuario puede seguir navegando y usando el resto de la app con normalidad, sin ningún elemento bloqueante
