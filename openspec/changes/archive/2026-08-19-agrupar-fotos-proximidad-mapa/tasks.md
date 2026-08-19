## 1. Agrupación por proximidad (route-map-photos.ts)

- [x] 1.1 Test rojo en `route-map-photos.spec.ts`: dado un conjunto de fotos con dos zonas GPS separadas más de 75m (p.ej. 4 fotos de una comida + 23 fotos de un mirador), `clusterPhotos(fotos, PHOTO_PROXIMITY_GROUP_RADIUS_METERS)` devuelve dos clusters con esos tamaños exactos
- [x] 1.2 Test rojo: una foto sin ninguna otra foto a menos de 75m forma un cluster de tamaño 1
- [x] 1.3 Test rojo: dos fotos justo por debajo/por encima de 75m se agrupan o no respectivamente (límite estricto `<`) — implementado como dos casos (~74m y ~76m) en vez de un único valor "exactamente 75.0", porque la igualdad flotante exacta contra el resultado de Haversine no es fiable como test determinista
- [x] 1.4 Implementación mínima: añadir constante `PHOTO_PROXIMITY_GROUP_RADIUS_METERS = 75` en `route-map-photos.ts`, junto a `PHOTO_CLUSTER_RADIUS_METERS`, y exportarla — verificar que los tests de 1.1-1.3 pasan reutilizando `clusterPhotos()` tal cual existe, sin tocar su firma

## 2. Clic en marcador-cluster abre el grupo en vez de hacer zoom

- [x] 2.1 Test rojo (actualizando la regresión AC-017 existente en `route-map.element.spec.ts`, que verificaba el comportamiento antiguo): al pulsar un marcador-cluster, se invoca `onPhotoClick` con una foto del cluster (no se llama a `map.flyTo`)
- [x] 2.2 Implementación mínima en `addPhotoMarkers()`: sustituir el `map.flyTo(...)` del caso `isCluster` por `onPhotoClick?.(cluster.photos[0])` — mismo callback que el caso individual

## 3. Visor filtrado por proximidad desde el mapa (route-detail.element.ts)

- [x] 3.1 Test rojo en `route-detail.element.spec.ts`: al recibir `ROUTE_MAP_PHOTO_SELECT_EVENT` para una foto con otras fotos cercanas (<75m) y otras lejanas (>75m) en la ruta, el visor se abre solo con las cercanas, ordenadas por `capturedAt` (más reciente primero, mismo orden que la galería — ver `MemoryPhotoRepository.getByRouteId`)
- [x] 3.2 Test rojo: al recibir el evento para una foto sin ninguna otra cercana, el visor se abre solo con esa foto (sin contador "X de Y", ya que `<photo-viewer>` no lo renderiza para un único elemento — comportamiento preexistente de `buildCounter`)
- [x] 3.3 Test rojo: abrir el visor desde la cuadrícula de "Fotos" sigue mostrando la lista completa de la ruta (regresión — comportamiento sin cambios)
- [x] 3.4 Implementación mínima: función pura `groupPhotosByProximity(photos, clickedPhotoId)` en un fichero nuevo `route-detail-photo-proximity.ts` (extraída de `route-detail.element.ts` por el límite de líneas de ESLint, `max-lines` — ver JSDoc del propio fichero) que calcula el grupo con `clusterPhotos(... con coordenadas, PHOTO_PROXIMITY_GROUP_RADIUS_METERS)`, localiza el cluster que contiene la foto pulsada por `id`, ordena por `capturedAt` y devuelve `{ photos, startIndex }`; el listener de `ROUTE_MAP_PHOTO_SELECT_EVENT` (línea ~240) llama a esta función y a `openPhotoViewer` directamente, en vez de `openPhotoViewerAt(index)`
- [x] 3.5 Verificar que `openPhotoViewerAt(index)` sigue intacto y es el que sigue usando la cuadrícula (línea ~356) y la línea de tiempo (que también llama a `openPhotoViewerAt`, sin cambios)

## 4. Verificación manual en dispositivo Android real

- [x] 4.1 En una ruta real con fotos en al menos dos zonas GPS separadas (p.ej. una parada y un mirador), confirmar en el APK que pulsar cada marcador del mapa abre el visor solo con las fotos de esa zona, y que la cuadrícula de "Fotos" sigue mostrando todas — confirmado por el usuario en dispositivo real

## 5. Cierre

- [x] 5.1 Actualizar `memory/context.md` con el estado de este cambio y el próximo hito (PR a `master` referenciando este cambio archivado)
