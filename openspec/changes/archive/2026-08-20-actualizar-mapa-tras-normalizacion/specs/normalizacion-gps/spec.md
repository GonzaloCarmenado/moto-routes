## MODIFIED Requirements

### Requirement: Normalización automática al sincronizar una ruta
Cuando el servidor recibe una ruta completa con sus puntos GPS (sincronización desde el móvil), SHALL intentar calcular una versión de esos puntos ajustada a la red de carreteras antes de responder, SHALL persistir el resultado junto con la ruta, y SHALL devolver en la propia respuesta de sincronización los puntos resultantes (originales o ajustados, según corresponda a cada uno).

#### Scenario: Ruta con puntos GPS ruidosos se normaliza al guardarse
- **WHEN** el móvil sincroniza una ruta cuyos puntos GPS incluyen desviaciones de la carretera (ej. un punto suelto a 40 metros del trazado real)
- **THEN** el servidor guarda, junto a los puntos originales, una versión ajustada a la carretera más probable para esos puntos
- **AND** la respuesta de sincronización (200) incluye, para cada punto ajustado, su posición corregida — no solo el id de la ruta

#### Scenario: Servicio de normalización no disponible
- **WHEN** el móvil sincroniza una ruta y el servicio de map-matching no responde o falla
- **THEN** la ruta se guarda igualmente con sus puntos originales, sin ajuste
- **AND** la sincronización no falla ni se reintenta automáticamente por este motivo — se trata como un intento best-effort
- **AND** la respuesta de sincronización devuelve los puntos originales, sin ninguno marcado como ajustado

#### Scenario: Punto GPS demasiado alejado de cualquier carretera
- **WHEN** el servicio de map-matching no encuentra ninguna carretera a una distancia razonable de un punto concreto (ej. el GPS saltó varios cientos de metros por un error puntual)
- **THEN** ese punto conserva su posición original sin forzarse a una carretera que no le corresponde, y así se refleja en la respuesta de sincronización
- **AND** el resto de puntos de la misma ruta que sí tengan una carretera cercana se normalizan con normalidad, y su posición ajustada también se refleja en la respuesta
