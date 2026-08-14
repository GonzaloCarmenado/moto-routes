## MODIFIED Requirements

### Requirement: Una ruta ya sincronizada se actualiza sola en la nube al modificarla localmente
La app SHALL volver a subir automáticamente (sin acción explícita del usuario) los metadatos de una ruta que ya está sincronizada, cada vez que esos datos cambian localmente — una ruta que nunca se ha subido no se ve afectada, sigue siendo puramente local hasta que el usuario decida subirla la primera vez. Añadir o borrar una foto en una ruta sincronizada, además, sube o borra la foto en sí contra el servidor, no solo los metadatos de la ruta.

#### Scenario: Guardar una nota en una ruta sincronizada la re-sube sola
- **WHEN** un usuario guarda una nota en el detalle de una ruta que ya está marcada como sincronizada
- **THEN** la app vuelve a subir la ruta a la nube en segundo plano, sin ninguna acción adicional del usuario y sin bloquear el guardado local (que ya ha tenido éxito)

#### Scenario: Marcar o desmarcar favorita una ruta sincronizada la re-sube sola
- **WHEN** un usuario marca o desmarca como favorita una ruta que ya está marcada como sincronizada
- **THEN** la app vuelve a subir la ruta a la nube en segundo plano, sin ninguna acción adicional del usuario y sin bloquear el cambio local (que ya ha tenido éxito)

#### Scenario: Añadir una foto en una ruta sincronizada la sube también a la nube
- **WHEN** un usuario añade una foto (cámara o galería) en el detalle de una ruta que ya está marcada como sincronizada
- **THEN** la app sube la foto al servidor y vuelve a subir los metadatos y puntos/paradas de la ruta en segundo plano, sin ninguna acción adicional del usuario y sin bloquear el guardado local de la foto (que ya ha tenido éxito)

#### Scenario: Borrar una foto en una ruta sincronizada la borra también de la nube
- **WHEN** un usuario borra una foto en el detalle de una ruta que ya está marcada como sincronizada, y esa foto ya tenía copia en el servidor
- **THEN** la app borra la copia remota de la foto y vuelve a subir los metadatos de la ruta en segundo plano, sin ninguna acción adicional del usuario y sin bloquear el borrado local (que ya ha tenido éxito)

#### Scenario: Modificar una ruta puramente local no la sube
- **WHEN** un usuario guarda una nota, marca/desmarca favorita, o añade/borra una foto, en una ruta que nunca se ha subido a la nube
- **THEN** la ruta sigue siendo puramente local — no se dispara ninguna subida ni borrado remoto

#### Scenario: La re-subida o el sincronizado de una foto falla sin bloquear ni deshacer el cambio local
- **WHEN** la re-subida automática de metadatos, la subida de una foto nueva, o el borrado remoto de una foto fallan (p. ej. sin conexión)
- **THEN** el cambio local (nota, favorito, foto añadida o foto borrada) permanece guardado, y la app no revierte nada ni interrumpe al usuario con un error bloqueante — solo muestra un aviso discreto
