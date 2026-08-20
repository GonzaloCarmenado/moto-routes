## Purpose

Permitir a un usuario sacar una ruta guardada de Moto Routes en un formato estándar e interoperable (GPX), para abrirla en otras aplicaciones de navegación o análisis (Strava, Google Earth, GPS de terceros).

## ADDED Requirements

### Requirement: Exportación de una ruta a GPX
El sistema SHALL permitir al usuario autenticado dueño de una ruta exportarla como un fichero GPX válido, usando los puntos normalizados a carretera cuando existan y los puntos originales cuando la ruta todavía no se haya normalizado.

#### Scenario: Exportación de una ruta normalizada
- **WHEN** el usuario dueño de una ruta ya normalizada solicita exportarla
- **THEN** el sistema genera un fichero GPX cuyo trazado usa los puntos ajustados a carretera

#### Scenario: Exportación de una ruta sin normalizar
- **WHEN** el usuario dueño de una ruta que no llegó a normalizarse (ej. fallo del servicio de map-matching en su momento) solicita exportarla
- **THEN** el sistema genera el fichero GPX igualmente, usando los puntos GPS originales

#### Scenario: Intento de exportar una ruta ajena o inexistente
- **WHEN** un usuario autenticado solicita exportar una ruta que no existe o que pertenece a otro usuario
- **THEN** el sistema responde igual en ambos casos (no encontrada), sin revelar si la ruta existe bajo otra cuenta — mismo criterio que la consulta de detalle de ruta

#### Scenario: Ruta sin puntos GPS
- **WHEN** el usuario solicita exportar una ruta que no tiene ningún punto GPS registrado
- **THEN** el sistema informa de que la ruta no tiene trazado que exportar, sin generar un fichero vacío

### Requirement: El GPX exportado incluye las paradas de la ruta
El fichero GPX generado SHALL incluir, además del trazado, las paradas registradas de la ruta como puntos de interés, de forma que se conserve esa información al abrir el fichero en otra aplicación.

#### Scenario: Exportación de una ruta con paradas
- **WHEN** el usuario exporta una ruta que tiene una o más paradas registradas
- **THEN** el fichero GPX incluye cada parada como un punto de interés independiente del trazado, con su posición

### Requirement: Formato GPX válido
El fichero generado SHALL cumplir el estándar GPX (versión 1.1), de forma que cualquier aplicación compatible con GPX pueda abrirlo sin errores.

#### Scenario: El fichero exportado es un GPX válido
- **WHEN** se genera la exportación de cualquier ruta con al menos un punto GPS
- **THEN** el fichero resultante es un XML GPX 1.1 bien formado, validable contra el esquema oficial

### Requirement: Acción de exportar desde el detalle de ruta
La aplicación móvil SHALL ofrecer, en la pantalla de detalle de una ruta guardada, una acción visible para exportarla a GPX y compartir o guardar el fichero resultante.

#### Scenario: El usuario exporta una ruta desde el detalle
- **WHEN** el usuario, viendo el detalle de una de sus rutas, pulsa la acción de exportar
- **THEN** la aplicación descarga el GPX generado por el servidor y ofrece compartirlo o guardarlo con el selector nativo del dispositivo

#### Scenario: Fallo de red al exportar
- **WHEN** el usuario pulsa exportar sin conexión o el servidor no responde
- **THEN** la aplicación muestra un aviso de error y no dejar la pantalla en un estado de carga indefinido
