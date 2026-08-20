## Purpose

Corregir en el servidor los puntos GPS ruidosos de una ruta (desplazados de la carretera real por error de precisión del GPS del móvil) para que el trazado guardado, mostrado y exportado sea fiable, sin depender de la calidad del GPS de cada dispositivo.

## ADDED Requirements

### Requirement: Normalización automática al sincronizar una ruta
Cuando el servidor recibe una ruta completa con sus puntos GPS (sincronización desde el móvil), SHALL intentar calcular una versión de esos puntos ajustada a la red de carreteras antes de responder, y SHALL persistir el resultado junto con la ruta.

#### Scenario: Ruta con puntos GPS ruidosos se normaliza al guardarse
- **WHEN** el móvil sincroniza una ruta cuyos puntos GPS incluyen desviaciones de la carretera (ej. un punto suelto a 40 metros del trazado real)
- **THEN** el servidor guarda, junto a los puntos originales, una versión ajustada a la carretera más probable para esos puntos
- **AND** la respuesta de sincronización es la misma (200 con el id de la ruta) que si no existiera normalización

#### Scenario: Servicio de normalización no disponible
- **WHEN** el móvil sincroniza una ruta y el servicio de map-matching no responde o falla
- **THEN** la ruta se guarda igualmente con sus puntos originales, sin ajuste
- **AND** la sincronización no falla ni se reintenta automáticamente por este motivo — se trata como un intento best-effort

#### Scenario: Punto GPS demasiado alejado de cualquier carretera
- **WHEN** el servicio de map-matching no encuentra ninguna carretera a una distancia razonable de un punto concreto (ej. el GPS saltó varios cientos de metros por un error puntual)
- **THEN** ese punto conserva su posición original sin forzarse a una carretera que no le corresponde
- **AND** el resto de puntos de la misma ruta que sí tengan una carretera cercana se normalizan con normalidad

### Requirement: Conservación de los puntos GPS originales
El sistema SHALL conservar los puntos GPS originales de cada ruta aunque exista una versión normalizada, de forma que el ajuste pueda repetirse en el futuro (ej. tras mejorar el algoritmo o los datos del mapa) sin pérdida de información.

#### Scenario: Los puntos originales siguen disponibles tras normalizar
- **WHEN** una ruta ya ha sido normalizada
- **THEN** los puntos GPS originales que envió el móvil siguen almacenados y no se sobrescriben con los puntos ajustados

### Requirement: Puntos normalizados no afectan a las paradas
La normalización de puntos GPS SHALL aplicarse únicamente al trazado (`route_points`); las paradas de una ruta (`route_stops`) no se ven alteradas por este proceso.

#### Scenario: Una parada conserva su posición original
- **WHEN** una ruta con paradas registradas se normaliza
- **THEN** la posición de cada parada permanece exactamente la que grabó el móvil
