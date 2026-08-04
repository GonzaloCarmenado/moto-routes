# route-stop-types-display Specification

## Purpose

Distingue visualmente cada tipo de parada en la previsualización de una ruta ya grabada (timeline y mapa), mostrando solo las paradas a las que el usuario asignó un tipo y ocultando el resto.

## Requirements

### Requirement: El timeline solo muestra paradas con tipo asignado
El timeline de detalle de ruta SHALL mostrar únicamente las paradas que tienen un tipo de catálogo asignado, con su icono correspondiente.

#### Scenario: Una parada manual tipada aparece en el timeline
- **WHEN** se visualiza el timeline de una ruta que tiene una parada manual con un tipo asignado
- **THEN** el timeline muestra un delimitador de parada con el icono de ese tipo

#### Scenario: Una ruta sin paradas tipadas no muestra delimitadores de parada
- **WHEN** se visualiza el timeline de una ruta que no tiene ninguna parada con tipo asignado (incluida cualquier parada detectada automáticamente, que nunca tiene tipo)
- **THEN** el timeline no muestra ningún delimitador de parada

### Requirement: El mapa distingue cada tipo de parada con su icono
El mapa de detalle de ruta SHALL mostrar un marcador por cada parada con tipo asignado, con el icono correspondiente a su tipo.

#### Scenario: Paradas de distinto tipo muestran iconos distintos
- **WHEN** se visualiza el mapa de una ruta con paradas de al menos dos tipos distintos
- **THEN** cada marcador de parada en el mapa muestra el icono de su propio tipo, distinguible del de los demás

#### Scenario: Una ruta sin paradas tipadas no muestra marcadores de parada
- **WHEN** se visualiza el mapa de una ruta sin ninguna parada con tipo asignado
- **THEN** el mapa no muestra ningún marcador de parada
