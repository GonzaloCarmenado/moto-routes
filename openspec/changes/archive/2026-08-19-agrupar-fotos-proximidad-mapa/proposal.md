## Why

Hoy, al pulsar cualquier marcador de foto en el mapa de detalle de ruta, el visor a pantalla completa se abre sobre **todas** las fotos de la ruta (solo cambia el índice inicial) — el usuario tiene que hacer swipe por decenas de fotos ajenas al punto que ha pulsado para encontrar las de esa zona. Si en una ruta larga hay una parada de comida (4 fotos) y un mirador (23 fotos), pulsar el marcador de la comida y pulsar el del mirador abren exactamente el mismo visor de 27 fotos. La vista general (pestaña "Fotos" en cuadrícula) ya cumple ese caso de "quiero ver todas"; pulsar un punto concreto del mapa debería mostrar solo las fotos de esa zona.

## What Changes

- Al pulsar un marcador de foto individual en el mapa, el visor se abre solo sobre el grupo de fotos GPS-cercanas a esa foto (radio fijo en metros, agrupación por distancia — sin componente temporal), ordenadas por hora de captura.
- Al pulsar un marcador-cluster en el mapa (varias fotos ya agrupadas visualmente por solapamiento de pines), en vez de solo hacer zoom, se abre directamente el visor con las fotos de esa zona.
- La pestaña "Fotos" en cuadrícula y el clic en cualquiera de sus miniaturas **no cambian**: siguen abriendo el visor sobre la ruta completa — es la vista pensada para ver todas las fotos.
- Las paradas (`route-map-stops.ts`) quedan fuera de este cambio: no tienen fotos asociadas hoy y no se les añade esa asociación aquí.
- El radio de agrupación semántica es un valor nuevo, fijo en metros, desacoplado del radio de clustering visual del mapa (ese depende del zoom y solo evita solapar pines — sigue existiendo igual, sin tocarse).

## Capabilities

### Modified Capabilities
- `route-photo-storage`: además de la API de almacenamiento (sin cambios), la spec pasa a cubrir también cómo el cliente agrupa y presenta las fotos de una ruta al visualizarlas desde el mapa — un requisito nuevo sobre agrupación por proximidad GPS al abrir el visor desde un marcador del mapa.

## Impact

- `apps/mobile/src/shared/route-map/route-map-photos.ts`: `clusterPhotos()` existe ya (agrupación haversine por radio) pero hoy es puramente visual (radio escalado por zoom, para evitar solapar pines). Hay que generalizar/reutilizar esa lógica de distancia con un radio semántico fijo e independiente del zoom.
- `apps/mobile/src/shared/route-map/route-map.element.ts` (líneas ~225-248): renderiza marcadores de foto y de parada como capas independientes; el callback de clic de foto (`ROUTE_MAP_PHOTO_SELECT_EVENT`) hoy solo pasa la foto pulsada, sin el grupo.
- `apps/mobile/src/routes/detail/route-detail.element.ts` (líneas ~240-243, ~353-357): único punto de apertura del visor (`openPhotoViewerAt`), hoy siempre sobre `this._photos` completo. Hay que diferenciar el origen "marcador de mapa" (grupo filtrado) del origen "cuadrícula/timeline" (lista completa, sin cambios).
- `apps/mobile/src/shared/photo-viewer/photo-viewer.element.ts`: sin cambios de contrato — sigue recibiendo un array plano de fotos + índice inicial; el filtrado ocurre antes de invocar `openPhotoViewer()`.
- `openspec/specs/route-photo-storage/spec.md`: su Purpose actual es puramente backend; se amplía para reflejar también este comportamiento de cliente.
