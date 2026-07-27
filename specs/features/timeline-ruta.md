# Feature: Timeline de Ruta (vista alternativa al mapa en detalle de ruta)

## Descripción
Nueva pestaña "Timeline" en `<route-detail>`, añadida junto a las pestañas existentes "Fotos", "Estadísticas" y "Notas", que muestra en orden cronológico los eventos de una ruta ya grabada — salida, paradas detectadas, fotos y llegada — junto con la velocidad media de cada tramo entre ellos. Es una vista alternativa y complementaria al mapa de la ruta, útil para repasar el trayecto como una secuencia de hitos en el tiempo en vez de como un trazado geográfico.

## Criterios de Aceptación

### Estructura y ubicación
- [ ] AC-001: Existe una 4ª pestaña "Timeline" en el `<tab-bar>` de `<route-detail>`, junto a "Fotos", "Estadísticas" y "Notas". El mapa (`<route-map>`) no cambia: sigue mostrándose siempre, fuera del tab-bar, exactamente igual que hoy.

### Salida y Llegada
- [ ] AC-002: Cuando la ruta tiene al menos 2 `route_points` persistidos, la timeline muestra un evento "Salida" con la hora y la ubicación (coordenadas) del primer punto GPS de la ruta, ordenando los puntos por `timestamp` ascendente.
- [ ] AC-003: Cuando la ruta tiene al menos 2 `route_points`, la timeline muestra un evento "Llegada" con la hora y la ubicación del último punto GPS de la ruta (mismo criterio de ordenación que AC-002).

### Paradas (cálculo derivado, no persistido)
- [ ] AC-004: Las paradas de la timeline se calculan al vuelo, cuando se abre la pestaña, a partir de los `route_points` ya persistidos de la ruta (los mismos ya cargados por `route-detail.element.ts` vía `getPointsByRouteId`), aplicando `detectStop()` de `cockpit.transform.ts` de forma secuencial sobre el array ordenado por `timestamp` — el mismo criterio conservador (velocidad ≤3 km/h, confirmación tras 30 puntos consecutivos) que ya usa la detección en vivo durante la grabación. No se persiste ninguna parada nueva en `route_stops`: es un cálculo derivado que se repite cada vez que se abre la pestaña.
- [ ] AC-005: Solo las rachas de velocidad baja que alcanzan el estado `confirmed-stop` (30 puntos consecutivos con velocidad ≤3 km/h) generan un evento de parada en la timeline. Las rachas que no llegan a confirmarse (el vehículo vuelve a moverse antes) no aparecen como parada — mismo criterio conservador que AC-018 de `grabacion-rutas.md`.
- [ ] AC-006: Cada parada mostrada incluye: hora de inicio (el punto en el que la velocidad cayó por debajo del umbral por primera vez en esa racha, no el punto de confirmación 30 puntos después), hora de fin (el primer punto posterior en el que la velocidad vuelve a superar el umbral) y ubicación (coordenadas del punto de inicio de la parada).
- [ ] AC-007: Si la ruta termina con el vehículo aún detenido (la parada nunca vuelve a estado "en movimiento" antes del último punto grabado de la ruta), la parada se muestra igualmente en la timeline, con hora de fin igual a la hora del último punto de la ruta.

### Fotos
- [ ] AC-008: Cada foto de la ruta (ya cargadas por `route-detail.element.ts` vía el repositorio de fotos, con su `capturedAt`) aparece en la timeline como un evento con su hora, en la posición cronológica que le corresponde respecto al resto de eventos.
- [ ] AC-009: Pulsar sobre un evento de tipo Foto en la timeline abre el visor de fotos (`openPhotoViewer`, la misma función ya usada por la galería y por los marcadores del mapa) posicionado en esa foto.

### Orden cronológico y tramos de velocidad media
- [ ] AC-010: Todos los eventos de la timeline (Salida, Paradas, Fotos, Llegada) se muestran ordenados estrictamente por su hora, de más antiguo a más reciente.
- [ ] AC-011: Entre cada dos eventos consecutivos que delimitan un tramo — Salida→primera parada, fin de una parada→inicio de la siguiente, última parada→Llegada, o directamente Salida→Llegada si no se detectó ninguna parada — se muestra la velocidad media de ese tramo. Las fotos no delimitan tramos: se muestran como marcadores dentro del tramo en el que caen cronológicamente, sin partirlo en dos.
- [ ] AC-012: La velocidad media de un tramo se calcula con el mismo criterio que `calculateAvgSpeed()` ya usa para `route.avgSpeed`: distancia acumulada (Haversine, `calculateDistance()`) entre los `route_points` consecutivos dentro del rango de tiempo del tramo, dividida entre la duración de ese tramo expresada en horas.
- [ ] AC-013: Si una ruta no tiene ninguna parada detectada, la timeline muestra un único tramo Salida→Llegada con la velocidad media de toda la ruta, sin ningún hueco ni mensaje de error.

### Edge cases de datos insuficientes
- [ ] AC-014: Si una ruta no tiene ninguna foto, la timeline se muestra igual (Salida, Paradas si las hay, Llegada, tramos de velocidad), sin ninguna foto listada y sin mensaje de error.
- [ ] AC-015: Si la ruta tiene menos de 2 `route_points` persistidos (0 o 1), no se puede determinar Salida, Llegada, paradas ni tramos: la pestaña Timeline muestra un mensaje explícito indicando que no hay datos GPS suficientes, en lugar de una timeline vacía, incompleta o con cálculos erróneos (p.ej. un tramo de duración/distancia cero).
- [ ] AC-016: Si la ruta tiene menos de 2 `route_points` (condición de AC-015) pero sí tiene fotos, esas fotos se listan igualmente en orden cronológico junto al mensaje de datos GPS insuficientes — las fotos no dependen de los `route_points` para mostrarse, solo de su propio `capturedAt`.
- [ ] AC-017: Si la ruta no tiene ni `route_points` suficientes (AC-015) ni fotos, se muestra un único mensaje de estado vacío para toda la pestaña (sin duplicar el mensaje de "sin datos GPS" y un segundo de "sin fotos").

### Presentación
- [ ] AC-018: Cada evento (Salida, Parada, Foto, Llegada) y cada fila de velocidad media de tramo de la timeline lleva su propio `data-cy` único, siguiendo la convención `<contexto>-<tipo>-<accion>` del proyecto.
- [ ] AC-019: La hora de cada evento se muestra en formato `HH:mm` de 24 horas (mismo criterio ya usado en el resto de la app: `toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })`).
- [ ] AC-020: La ubicación de Salida, Llegada y cada Parada se muestra como coordenadas (latitud y longitud) con 4 decimales — la app no tiene capacidad de geocodificación inversa hoy, no se muestra ninguna dirección textual.
- [ ] AC-021: La velocidad media de cada tramo se muestra como número entero seguido de la unidad "km/h", mismo criterio de formato que el resto de valores de velocidad de la app.

## Comportamiento Esperado

### Escenario: Ruta con paradas y fotos (Happy Path)
- **Dado** que el usuario abre el detalle de una ruta ya grabada, con varios `route_points`, dos paradas detectables y tres fotos capturadas durante el trayecto
- **Cuando** pulsa la pestaña "Timeline"
- **Entonces** ve, en orden cronológico: el evento "Salida" con hora y ubicación, la velocidad media del primer tramo, la primera parada (hora inicio/fin y ubicación), la velocidad media del siguiente tramo (con las fotos capturadas en ese intervalo mostradas como marcadores dentro de él), la segunda parada, la velocidad media del último tramo, y el evento "Llegada"

### Escenario: Ruta sin ninguna parada detectada
- **Dado** que una ruta tiene `route_points` suficientes pero la velocidad nunca cae por debajo del umbral de forma sostenida
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve el evento "Salida", un único tramo con la velocidad media de toda la ruta, y el evento "Llegada", sin ningún evento de parada intermedio

### Escenario: Ruta sin ninguna foto
- **Dado** que una ruta tiene `route_points` y paradas detectadas pero no tiene ninguna foto asociada
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve Salida, paradas y Llegada con sus tramos de velocidad media, sin ningún evento de foto y sin mensaje de error

### Escenario: Parada que sigue activa al terminar la ruta
- **Dado** que la velocidad del vehículo cae por debajo del umbral y se confirma como parada, pero la ruta se detiene (long-press STOP) antes de que el vehículo vuelva a moverse
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve esa parada con hora de fin igual a la hora del último punto GPS registrado de la ruta

### Escenario: Ruta con menos de 2 puntos GPS y sin fotos
- **Dado** que una ruta quedó guardada con 0 o 1 `route_points` (p.ej. una grabación interrumpida casi al inicio) y sin ninguna foto
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve un único mensaje de estado vacío indicando que no hay datos suficientes, sin ningún evento de Salida, Llegada, parada o tramo

### Escenario: Ruta con menos de 2 puntos GPS pero con fotos
- **Dado** que una ruta tiene 0 o 1 `route_points` pero sí tiene fotos capturadas
- **Cuando** el usuario abre la pestaña "Timeline"
- **Entonces** ve las fotos listadas en orden cronológico por su hora de captura, junto con un mensaje indicando que no hay datos GPS suficientes para mostrar Salida, Llegada, paradas o tramos

### Escenario: Abrir el visor de fotos desde un evento de la timeline
- **Dado** que la timeline muestra un evento de tipo Foto
- **Cuando** el usuario lo pulsa
- **Entonces** se abre el visor de fotos (`openPhotoViewer`) posicionado en esa foto concreta, igual que al pulsarla desde la galería o desde el mapa

## Constraints
- No se persiste ninguna parada nueva en `route_stops`, ni los eventos de la timeline, ni las velocidades por tramo: todo se recalcula cada vez que se abre la pestaña a partir de los `route_points` y fotos ya persistidos. Se acepta el coste de reprocesar el array de puntos en cada apertura.
- El criterio de detección de paradas (umbral 3 km/h, 30 puntos de confirmación) reutiliza `detectStop()` de `cockpit.transform.ts` sin modificarla: cualquier cambio futuro de ese umbral afecta a la vez a la detección en vivo durante la grabación y a este cálculo a posteriori.
- El mapa de `<route-detail>` no cambia de comportamiento, estructura ni ubicación con esta feature — sigue mostrándose siempre, fuera del `<tab-bar>`.
- Las fotos con `capturedAt` fuera del rango temporal `[Salida, Llegada]` de la ruta (p.ej. añadidas manualmente desde la galería tras guardar la ruta) igualmente se muestran en la timeline, en su posición cronológica real — no se descartan ni se fuerzan dentro del rango.

## Dependencias
- **`grabacion-rutas`** (`cockpit.transform.ts` → `detectStop()`): se reutiliza tal cual, sin modificarla, para calcular las paradas a posteriori sobre los puntos ya persistidos.
- **`fotos-ruta`** / **`mejoras-fotos-mapa`**: las fotos ya se cargan con `capturedAt` en `route-detail.element.ts`, y `openPhotoViewer` ya existe como punto único de apertura del visor (reutilizado por AC-009).
- **`mejoras-guardado-rutas`** (`<tab-bar>`, ya usado para las pestañas "Fotos"/"Estadísticas"/"Notas"): Timeline se añade como una pestaña más con la misma API (`tabs`, `slot="{id}"`).
- **Persistencia** (`IRouteRepository.getPointsByRouteId()`, `IPhotoRepository.getByRouteId()`): ambos ya se invocan en `route-detail.element.ts` → `fetchAndRender()`; la timeline reutiliza esos mismos datos ya cargados, sin peticiones adicionales.

## Notas de Implementación
- Función pura sugerida `detectStopsFromPoints(points: RoutePoint[]): { startTime: number; endTime: number; lat: number; lng: number }[]`, en un módulo de transformación nuevo del dominio `routes` (p.ej. `route-timeline.transform.ts`), que reutiliza `detectStop()` de `cockpit.transform.ts` en un bucle secuencial sobre los puntos ordenados por `timestamp`, sin duplicar su lógica.
- Reutilizar `calculateDistance()`/`calculateAvgSpeed()` de `cockpit.transform.ts` para la velocidad media de cada tramo (AC-012) — no reimplementar la fórmula Haversine ni la división distancia/tiempo.
- Panel de la pestaña: mismo patrón ya usado por `buildPhotosSection()`/`buildNotasPanel()` — un `<div slot="timeline">` añadido a `<tab-bar>` dentro de `buildTabBar()` en `route-detail.element.ts`. Los paneles de `<tab-bar>` no se destruyen al cambiar de pestaña (contrato ya documentado en `tab-bar.element.ts`), así que no hace falta recalcular la timeline al volver a la pestaña salvo que cambien los datos de la ruta.
- `data-cy` sugeridos: `route-detail-timeline-evento-salida`, `route-detail-timeline-evento-llegada`, `route-detail-timeline-evento-parada-{n}`, `route-detail-timeline-evento-foto-{id}`, `route-detail-timeline-tramo-{n}`, `route-detail-timeline-vacio` (mensaje de estado vacío de AC-015/AC-017).
- Para AC-011/AC-012, el tramo "fin de una parada→inicio de la siguiente" usa como límites las horas de fin/inicio ya calculadas en AC-006/AC-007 (no los timestamps de los `route_points` inmediatamente adyacentes), para que la suma de duraciones de todos los tramos más las paradas coincida exactamente con la duración total de la ruta.
- Un tramo con duración cero (p.ej. una parada detectada justo en el primer punto de la ruta, sin tramo real de Salida a esa parada) debe mostrar velocidad media 0 km/h, reutilizando el guard ya existente en `calculateAvgSpeed()` (`timeSeconds <= 0` → devuelve 0), sin necesidad de un caso especial adicional.
