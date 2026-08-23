# identidad-cuenta Specification

## Purpose

Unifica la identidad visible del usuario (nombre y foto de perfil) con su cuenta en el servidor, en vez de un nombre y un avatar guardados solo en el dispositivo — así se muestran los mismos en cualquier dispositivo donde inicie sesión, y el nombre deja de duplicar al `username` ya obligatorio de toda cuenta.

## Requirements

### Requirement: El nombre mostrado en Perfil es el username de la cuenta
La app SHALL mostrar el `username` de la cuenta autenticada como nombre en Perfil, y SHALL dejar de ofrecer ningún campo de nombre local independiente de la cuenta.

#### Scenario: Perfil muestra el username como nombre
- **WHEN** un usuario con sesión activa abre Perfil
- **THEN** el nombre mostrado es el `username` de su cuenta, sin ningún campo de nombre editable por separado

#### Scenario: Sin sesión activa, Perfil no muestra ningún nombre de cuenta
- **WHEN** un usuario sin sesión activa abre Perfil
- **THEN** no se muestra ningún nombre (ni el placeholder de un nombre local, que ya no existe)

### Requirement: Subir el avatar de la cuenta autenticada
La API SHALL permitir a un usuario autenticado subir una imagen como avatar de su cuenta, almacenada cifrada en reposo, sustituyendo cualquier avatar anterior de esa misma cuenta.

#### Scenario: Subida correcta
- **WHEN** un usuario autenticado sube una imagen como avatar
- **THEN** la API la almacena cifrada y queda asociada a su cuenta, disponible para descargar

#### Scenario: Subir un avatar nuevo sustituye al anterior
- **WHEN** un usuario autenticado que ya tenía un avatar sube uno nuevo
- **THEN** la API sustituye el avatar anterior por el nuevo, sin conservar el anterior ni acumular varios

#### Scenario: Un avatar que supera el tamaño máximo se rechaza
- **WHEN** un usuario autenticado intenta subir una imagen que supera el tamaño máximo soportado
- **THEN** la API rechaza la subida con un error explicando el motivo, sin almacenar una copia parcial ni sustituir el avatar ya existente

#### Scenario: Sin sesión activa no se puede subir avatar
- **WHEN** se intenta subir un avatar sin un token de sesión válido
- **THEN** la API rechaza la petición sin almacenar nada

### Requirement: Descargar el avatar de la cuenta autenticada
La API SHALL permitir a un usuario autenticado descargar el avatar de su propia cuenta, descifrándolo al vuelo — nunca mediante una URL que apunte directamente al almacenamiento subyacente.

#### Scenario: Descarga correcta
- **WHEN** un usuario autenticado cuya cuenta tiene un avatar configurado lo descarga
- **THEN** la API devuelve los bytes originales de la imagen (ya descifrados), con el tipo de contenido correcto

#### Scenario: Cuenta sin avatar configurado
- **WHEN** un usuario autenticado cuya cuenta no tiene ningún avatar configurado intenta descargarlo
- **THEN** la API responde con un error claro de "no encontrado", sin fallar de forma silenciosa ni ambigua

#### Scenario: Sin sesión activa no se puede descargar ningún avatar
- **WHEN** se intenta descargar un avatar sin un token de sesión válido
- **THEN** la API rechaza la petición

### Requirement: El avatar se almacena cifrado en reposo
El avatar SHALL almacenarse cifrado en el almacenamiento subyacente, de forma que un acceso directo a ese almacenamiento (sin pasar por la API) no permita reconstruir la imagen original — mismo criterio ya aplicado a las fotos de ruta.

#### Scenario: Los bytes almacenados no son la imagen original
- **WHEN** se inspeccionan directamente los bytes guardados en el almacenamiento subyacente para un avatar ya subido
- **THEN** esos bytes no se pueden interpretar como una imagen válida sin la clave de cifrado, que nunca se almacena junto a ellos

### Requirement: El avatar se descarga automáticamente al iniciar sesión
La app SHALL descargar y mostrar el avatar de la cuenta (si tiene uno configurado) tanto al arrancar en frío con una sesión ya guardada como tras un login interactivo — sin exigir que el usuario lo suba de nuevo en cada dispositivo.

#### Scenario: Arranque en frío con sesión guardada y avatar ya configurado
- **WHEN** la app arranca con una sesión ya guardada de una cuenta que tiene avatar configurado
- **THEN** Perfil muestra ese avatar sin que el usuario tenga que volver a subirlo

#### Scenario: Login interactivo en un dispositivo que nunca subió el avatar
- **WHEN** un usuario inicia sesión en un dispositivo donde nunca ha subido ningún avatar, pero su cuenta ya tiene uno configurado desde otro dispositivo
- **THEN** Perfil descarga y muestra ese avatar

#### Scenario: Cuenta sin avatar configurado en ningún dispositivo
- **WHEN** un usuario con sesión activa cuya cuenta nunca tuvo avatar abre Perfil
- **THEN** se muestra el mismo estado vacío que hoy (sin avatar), sin ningún error visible

#### Scenario: Fallo de red al descargar el avatar no bloquea el resto de la app
- **WHEN** la descarga del avatar falla (p. ej. sin conexión)
- **THEN** el resto de Perfil funciona con normalidad, sin avatar mostrado hasta la próxima descarga con éxito

### Requirement: Subir un nuevo avatar desde Perfil
La app SHALL permitir a un usuario con sesión activa cambiar el avatar de su cuenta desde Perfil en cualquier momento, reflejándolo de inmediato tras una subida correcta.

#### Scenario: Cambiar el avatar con éxito
- **WHEN** un usuario con sesión activa elige una nueva imagen de avatar desde Perfil
- **THEN** la app la sube a su cuenta y la muestra de inmediato, sin tener que recargar la pantalla

#### Scenario: La subida del avatar falla sin perder el avatar anterior
- **WHEN** la subida de un nuevo avatar falla (p. ej. sin conexión, o supera el tamaño máximo)
- **THEN** la app muestra un error explicándolo y sigue mostrando el avatar anterior, sin dejarlo en un estado vacío o inconsistente
