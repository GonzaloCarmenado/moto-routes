# actualizacion-in-app Specification

## Purpose

Permite a quien usa la app en Android saber que hay una versión más reciente y actualizarla sin salir de la app ni pasar por Android Studio o `adb`, dentro de los límites que el propio sistema operativo impone a la instalación de APKs fuera de Google Play.

## Requirements

### Requirement: La app comprueba si hay una versión más reciente al abrirse
En cada arranque en frío, sobre Android, la app SHALL consultar la última release publicada del repositorio y comparar su versión contra la versión instalada. La comprobación SHALL ser asíncrona y SHALL NOT bloquear ni retrasar el arranque de la app.

#### Scenario: Hay una versión más reciente publicada
- **WHEN** la app arranca y la última release publicada tiene una versión distinta (más nueva) que la instalada
- **THEN** la app muestra un aviso no bloqueante ofreciendo actualizar, sin interrumpir el uso normal de la app

#### Scenario: La versión instalada ya es la más reciente
- **WHEN** la app arranca y la última release publicada coincide con la versión instalada
- **THEN** no se muestra ningún aviso de actualización

#### Scenario: La comprobación falla por falta de conexión
- **WHEN** la app arranca sin conexión a internet y no puede consultar la última release
- **THEN** la app arranca con normalidad, sin ningún aviso de actualización ni error visible, y sin reintentar hasta el siguiente arranque

#### Scenario: La comprobación falla por un error de la fuente de versiones
- **WHEN** la consulta de la última release responde con un error o excede un límite de peticiones
- **THEN** la app arranca con normalidad, sin ningún aviso de actualización ni error visible

#### Scenario: Fuera de Android, la app no comprueba actualizaciones
- **WHEN** la app se ejecuta en modo web de desarrollo o en cualquier entorno que no sea el APK de Android
- **THEN** no se realiza ninguna comprobación de versión ni se muestra ningún aviso relacionado

### Requirement: Notificación local si hay una actualización disponible
Si la comprobación de versión detecta una actualización disponible, la app SHALL mostrar una notificación local del sistema, además del aviso dentro de la propia app. La app SHALL NOT notificar más de una vez por versión detectada.

#### Scenario: Primera vez que se detecta una versión nueva
- **WHEN** la comprobación de versión detecta por primera vez una versión más reciente que la instalada
- **THEN** se muestra una notificación local del sistema informando de la actualización disponible

#### Scenario: La misma versión ya fue notificada
- **WHEN** la comprobación de versión, en un arranque posterior, vuelve a detectar la misma versión que ya se notificó antes
- **THEN** no se muestra una notificación nueva para esa versión (el aviso dentro de la app SÍ sigue visible mientras no se actualice)

#### Scenario: El permiso de notificaciones no está concedido
- **WHEN** se detecta una actualización disponible pero el permiso de notificaciones del sistema no está concedido
- **THEN** el aviso dentro de la propia app sigue mostrándose con normalidad, sin que la ausencia de notificación bloquee ni degrade el resto del flujo

### Requirement: Descarga del APK dentro de la app
Desde el aviso de actualización disponible, la app SHALL permitir iniciar la descarga del APK de la nueva versión sin salir de la app, mostrando el progreso de la descarga. La descarga SHALL requerir una acción explícita del usuario — SHALL NOT iniciarse automáticamente al detectar la actualización.

#### Scenario: Descarga iniciada por el usuario
- **WHEN** el usuario pulsa la opción de descargar desde el aviso de actualización
- **THEN** la app descarga el APK de la última release y muestra el progreso de la descarga

#### Scenario: Descarga completada con éxito
- **WHEN** la descarga del APK termina sin errores
- **THEN** la app ofrece continuar con la instalación

#### Scenario: Fallo de red durante la descarga
- **WHEN** la conexión se pierde o falla mientras se descarga el APK
- **THEN** la app muestra un error de descarga y permite reintentar, sin dejar ficheros parciales que interfieran en un reintento posterior

### Requirement: Instalación lanzada desde dentro de la app
Tras completar la descarga, la app SHALL lanzar el instalador nativo de Android sobre el APK descargado. Dado que Android exige el permiso `REQUEST_INSTALL_PACKAGES` y la confirmación explícita del usuario para instalar un APK fuera de Google Play, la app SHALL NOT intentar ni simular una instalación silenciosa sin esa confirmación.

#### Scenario: Instalación lanzada tras una descarga completa
- **WHEN** el usuario continúa con la instalación tras una descarga completada
- **THEN** la app lanza el instalador nativo de Android con el APK descargado, y el sistema pide confirmación al usuario

#### Scenario: El permiso de instalar APKs externos no está concedido
- **WHEN** el usuario intenta instalar y la app no tiene concedido el permiso `REQUEST_INSTALL_PACKAGES`
- **THEN** la app dirige al usuario a concederlo (mismo patrón que la comprobación de permiso de ubicación ya existente) antes de reintentar el lanzamiento del instalador

#### Scenario: El usuario cancela el diálogo de instalación del sistema
- **WHEN** el usuario cierra o cancela el diálogo de instalación lanzado por Android
- **THEN** la app vuelve a un estado normal, con el APK ya descargado disponible para reintentar la instalación sin volver a descargarlo
- **Nota de verificación manual**: `Intent.ACTION_VIEW` no informa a la app si el usuario canceló la instalación — no automatizable con Vitest/Cypress, verificado a mano en dispositivo Android real.

#### Scenario: La instalación falla por incompatibilidad de firma
- **WHEN** el instalador de Android rechaza el APK descargado por no coincidir su firma con la de la versión instalada
- **THEN** la app muestra un mensaje explicando que hace falta desinstalar la versión actual para continuar, sin presentarlo como un error genérico
- **Nota de verificación manual**: este escenario es la salvaguarda ante una regresión futura de firma (ver capability `ci-cd`); con el keystore de release persistente en su sitio no debería ocurrir en uso normal, pero el mensaje de error debe existir igualmente.
