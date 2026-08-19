## ADDED Requirements

### Requirement: Agrupar fotos por proximidad GPS al abrir el visor desde el mapa
Al pulsar un marcador de foto en el mapa de detalle de ruta (individual o representando varias fotos agrupadas visualmente), el sistema SHALL abrir el visor a pantalla completa mostrando únicamente las fotos cuya distancia GPS respecto a la foto pulsada sea inferior a 75 metros, ordenadas por hora de captura — nunca la lista completa de fotos de la ruta.

#### Scenario: Pulsar un marcador de foto individual muestra solo las fotos cercanas
- **WHEN** un usuario pulsa un marcador de foto en el mapa que representa una foto tomada durante una parada, y existen otras fotos de esa ruta tomadas a más de 75 metros de esa parada
- **THEN** el visor se abre solo con las fotos tomadas a menos de 75 metros de la foto pulsada, sin incluir las fotos de otras zonas de la ruta

#### Scenario: Pulsar un marcador que agrupa varias fotos cercanas abre el visor con esa zona
- **WHEN** un usuario pulsa un marcador del mapa que representa varias fotos agrupadas por solaparse visualmente en el mapa
- **THEN** el visor se abre directamente con las fotos de esa zona, ordenadas por hora de captura, sin necesidad de hacer zoom antes

#### Scenario: Una foto sin otras fotos cercanas abre el visor solo con ella
- **WHEN** un usuario pulsa el marcador de una foto que no tiene ninguna otra foto de la ruta a menos de 75 metros
- **THEN** el visor se abre mostrando únicamente esa foto

#### Scenario: La vista general de fotos no se ve afectada por la agrupación por proximidad
- **WHEN** un usuario abre el visor desde la cuadrícula de la pestaña "Fotos" o desde la línea de tiempo de la ruta
- **THEN** el visor se abre sobre todas las fotos de la ruta, en el mismo orden que la vista de origen, sin aplicar ningún filtro de proximidad
