## Context

Ver `proposal.md` — Why / What Changes. Código relevante ya existente:

- `apps/mobile/src/shared/route-map/route-map-photos.ts`: `clusterPhotos<T extends Photo>(photos, radiusMeters)` ya agrupa fotos por distancia Haversine (`haversineDistance`, no exportada), devolviendo `PhotoCluster<T>[]` con centroide. Hoy `addPhotoMarkers()` la usa solo para clustering **visual** con `PHOTO_CLUSTER_RADIUS_METERS = 50`, escalado por zoom vía `photoClusterRadiusForZoom()`. Clic en marcador individual → `onPhotoClick?.(cluster.photos[0])`; clic en marcador-cluster → `map.flyTo()` (zoom), sin invocar `onPhotoClick`.
- `apps/mobile/src/routes/detail/route-detail.element.ts`: escucha `ROUTE_MAP_PHOTO_SELECT_EVENT` (línea 240-243) y llama a `openPhotoViewerAt(index)` (línea 355-357), que siempre abre `openPhotoViewer({ photos: toGalleryPhotos(this._photos), startIndex, onDelete })` sobre la lista completa. La cuadrícula (línea 364) y la línea de tiempo (línea 456-458) llaman al mismo `openPhotoViewerAt`.
- `Photo.capturedAt: string` (ISO 8601) ya existe en `photo.types.ts` — no hace falta un campo nuevo para ordenar por hora de captura.

## Goals / Non-Goals

**Goals:**
- Filtrar el visor a las fotos GPS-cercanas (< 75m) a la foto pulsada en el mapa, ordenadas por `capturedAt`.
- Que el clic en un marcador-cluster abra el visor con esa zona en vez de solo hacer zoom.
- Reutilizar `clusterPhotos()` tal cual existe, sin tocar su firma ni el clustering visual del mapa (`PHOTO_CLUSTER_RADIUS_METERS` / `photoClusterRadiusForZoom` no cambian).

**Non-Goals:**
- No se toca la cuadrícula de la pestaña "Fotos" ni la línea de tiempo — siguen llamando a `openPhotoViewerAt(index)` sobre la lista completa, sin cambios.
- No se añade asociación de fotos a paradas (`route-map-stops.ts` queda fuera).
- No se persiste ni configura el radio de 75m — es una constante de código, no una preferencia de usuario.

## Decisions

**Radio de agrupación semántica independiente del radio visual del mapa.** Se añade una constante nueva `PHOTO_PROXIMITY_GROUP_RADIUS_METERS = 75` en `route-map-photos.ts`, junto a la ya existente `PHOTO_CLUSTER_RADIUS_METERS = 50`. Son conceptualmente distintas aunque usen la misma función: la de 50m es visual y se escala con el zoom (evita solapar pines); la de 75m es semántica y fija (define qué fotos "pertenecen" a la misma parada, independiente de cómo se vean los pines en ese momento). Alternativa descartada: reutilizar el mismo radio de 50m — se rechaza porque mezclaría dos conceptos con propósitos distintos y el visual cambia con el zoom, lo que haría que el mismo clic mostrara un grupo distinto de fotos según el nivel de zoom en el que estuviera el mapa al pulsar.

**El cálculo del grupo se hace del lado de `route-detail`, no en `route-map-photos.ts`.** Al recibir `ROUTE_MAP_PHOTO_SELECT_EVENT`, en vez de llamar a `openPhotoViewerAt(index)` (que opera sobre la lista completa), el listener ejecuta una función nueva `groupPhotosByProximity(photos, clickedPhotoId)` que aplica `clusterPhotos(... con coordenadas, PHOTO_PROXIMITY_GROUP_RADIUS_METERS)`, localiza el cluster que contiene la foto pulsada por `id`, ordena por `capturedAt` y devuelve `{ photos, startIndex }`, y abre `openPhotoViewer(...)` directamente con ese resultado. Esta función vive en un fichero nuevo, `route-detail-photo-proximity.ts` — no en `route-detail.element.ts` como método de instancia — porque añadirla ahí superaba el límite de líneas de ESLint (`max-lines`) del proyecto; es una extracción por tamaño, no un dominio propio (mismo patrón ya documentado en CLAUDE.md para `route-detail-notes.ts`). Alternativa descartada: precalcular los grupos una vez en `renderPhotoMarkers()` y guardarlos en el estado del componente — se rechaza por complejidad innecesaria; recalcular `clusterPhotos` al clic es barato (mismo coste que el clustering visual que ya se recalcula en cada render del mapa) y evita mantener dos estructuras de agrupación sincronizadas.

**Clic en marcador-cluster deja de hacer zoom y pasa a invocar `onPhotoClick` con una foto representativa del cluster.** En `addPhotoMarkers()`, el `hitArea.addEventListener('click', ...)` del caso `isCluster` cambia de `map.flyTo(...)` a `onPhotoClick?.(cluster.photos[0])` — exactamente el mismo callback que ya usa el caso individual. La distinción visual (icono con contador vs icono simple) no cambia. Esto simplifica la capa de mapa: ya no necesita saber nada de agrupación semántica, solo delega en el mismo evento y es `route-detail.element.ts` quien decide qué grupo mostrar con el radio de 75m, desacoplado del radio visual con el que se dibujó ese pin concreto.

## Risks / Trade-offs

- [`clusterPhotos()` es O(n²) en el número de fotos con coordenadas] → Ya es el algoritmo usado hoy para el clustering visual sobre el mismo conjunto de datos en cada render del mapa; recalcularlo una vez más al clic no cambia el orden de magnitud del coste ya asumido. Si en el futuro una ruta acumula miles de fotos, revisar entonces — fuera de alcance de este cambio.
- [Cambio en `route-map-photos.ts`, módulo `shared/route-map/`] → Consumido hoy por `route-map.element.ts` y, para `clusterPhotos`/`PHOTO_PROXIMITY_GROUP_RADIUS_METERS`, también por el nuevo `route-detail-photo-proximity.ts`. Radio de impacto contenido a `shared/route-map/` y `routes/detail/`; no hay otro dominio que importe `addPhotoMarkers` o `clusterPhotos`.
- [Foto exactamente a 75.0m de distancia] → `clusterPhotos` usa `<` estricto (línea 119 de `route-map-photos.ts`), coherente con el escenario de spec ya redactado como "inferior a 75 metros".
