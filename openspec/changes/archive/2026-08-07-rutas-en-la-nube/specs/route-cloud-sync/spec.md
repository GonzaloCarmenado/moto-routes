## Purpose

Permite subir una ruta grabada localmente a la cuenta del usuario autenticado, y ver en un único listado combinado las rutas que existen en este dispositivo y las que además (o solo) existen en el servidor — sin fotos, y sin exigir sesión para las rutas ya locales.

## ADDED Requirements

### Requirement: Subir una ruta local a la cuenta del usuario
La app SHALL permitir subir una ruta local completa (metadatos, puntos GPS y paradas — sin fotos) a la cuenta del usuario con sesión activa.

#### Scenario: Subida correcta
- **WHEN** un usuario con sesión activa pulsa "Subir a la nube" en el detalle de una ruta local
- **THEN** la ruta pasa a existir también en el servidor, y el listado la muestra como sincronizada

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

### Requirement: El listado combina rutas locales y de la nube sin duplicar
La pantalla de listado de rutas SHALL mostrar, en una sola lista, las rutas de este dispositivo y las de la cuenta del usuario con sesión activa, sin mostrar la misma ruta dos veces, distinguiendo su estado con un indicador visual.

#### Scenario: Ruta solo local
- **WHEN** una ruta existe únicamente en este dispositivo (no se ha subido)
- **THEN** el listado la muestra con el indicador de "solo local"

#### Scenario: Ruta local ya sincronizada
- **WHEN** una ruta existe tanto en este dispositivo como en la cuenta del usuario
- **THEN** el listado la muestra una sola vez, con el indicador de "sincronizada"

#### Scenario: Ruta que solo existe en la nube
- **WHEN** una ruta existe en la cuenta del usuario pero no en este dispositivo
- **THEN** el listado la muestra con el indicador de "en la nube", junto a las locales

#### Scenario: Sin sesión activa, el listado se comporta igual que hoy
- **WHEN** un usuario sin sesión activa abre el listado de rutas
- **THEN** la app muestra únicamente las rutas locales de este dispositivo, sin ningún indicador de nube

#### Scenario: Con sesión activa pero sin conexión al abrir el listado
- **WHEN** un usuario con sesión activa abre el listado de rutas sin conexión de red
- **THEN** la app muestra igualmente las rutas locales sin bloquearse, y no muestra ninguna ruta exclusiva de la nube hasta poder consultarlas

### Requirement: Ver el detalle completo de una ruta que solo existe en la nube
La app SHALL permitir abrir el detalle completo (mapa y timeline) de una ruta que solo existe en el servidor, descargando sus datos bajo demanda.

#### Scenario: Abrir el detalle de una ruta que solo existe en la nube
- **WHEN** un usuario con sesión activa entra en una ruta del listado marcada como "en la nube"
- **THEN** la app descarga sus puntos y paradas del servidor y muestra el mismo detalle (mapa, timeline) que una ruta local

#### Scenario: Abrir una ruta exclusiva de la nube sin conexión
- **WHEN** un usuario intenta abrir el detalle de una ruta exclusiva de la nube sin conexión de red
- **THEN** la app muestra un error explicándolo, sin fallar de forma silenciosa

### Requirement: Cada usuario solo ve y sube a sus propias rutas de la nube
El listado y el detalle de rutas de la nube SHALL mostrar únicamente las rutas asociadas a la cuenta del usuario con sesión activa, determinada por su token — nunca por un identificador que el cliente pueda elegir.

#### Scenario: El listado de rutas de la nube solo muestra las de la cuenta activa
- **WHEN** un usuario con sesión activa abre el listado de rutas
- **THEN** las rutas "en la nube"/"sincronizada" mostradas pertenecen únicamente a su propia cuenta

#### Scenario: No se puede acceder al detalle de una ruta de la nube de otra cuenta
- **WHEN** un usuario con sesión activa intenta abrir el detalle de una ruta de la nube que pertenece a otra cuenta (por ejemplo, adivinando o reutilizando un identificador)
- **THEN** la petición se rechaza sin revelar si esa ruta existe

### Requirement: Una ruta ya sincronizada se actualiza sola en la nube al modificarla localmente
La app SHALL volver a subir automáticamente (sin acción explícita del usuario) los metadatos de una ruta que ya está sincronizada, cada vez que esos datos cambian localmente — una ruta que nunca se ha subido no se ve afectada, sigue siendo puramente local hasta que el usuario decida subirla la primera vez.

#### Scenario: Guardar una nota en una ruta sincronizada la re-sube sola
- **WHEN** un usuario guarda una nota en el detalle de una ruta que ya está marcada como sincronizada
- **THEN** la app vuelve a subir la ruta a la nube en segundo plano, sin ninguna acción adicional del usuario y sin bloquear el guardado local (que ya ha tenido éxito)

#### Scenario: Añadir o borrar una foto en una ruta sincronizada re-sube sus metadatos
- **WHEN** un usuario añade o borra una foto en el detalle de una ruta que ya está marcada como sincronizada
- **THEN** la app vuelve a subir los metadatos y puntos/paradas de la ruta a la nube en segundo plano — la foto en sí no se sube (sigue fuera de alcance, ver Non-Goals de `design.md`)

#### Scenario: Modificar una ruta puramente local no la sube
- **WHEN** un usuario guarda una nota, o añade/borra una foto, en una ruta que nunca se ha subido a la nube
- **THEN** la ruta sigue siendo puramente local — no se dispara ninguna subida automática

#### Scenario: La re-subida automática falla sin bloquear ni deshacer el cambio local
- **WHEN** la re-subida automática de una ruta sincronizada falla (p. ej. sin conexión)
- **THEN** el cambio local (nota o foto) permanece guardado, y la app no revierte nada ni interrumpe al usuario con un error bloqueante
