/**
 * Agrupación de fotos por proximidad GPS al abrir el visor desde un marcador del mapa
 * (agrupar-fotos-proximidad-mapa). Extraído de route-detail.element.ts por límite de
 * líneas del proyecto (eslint.config.js, max-lines) — no por ser un dominio propio.
 */
import { clusterPhotos, PHOTO_PROXIMITY_GROUP_RADIUS_METERS } from '../../shared/route-map/route-map-photos.js';
import type { PhotoWithUrl } from './route-detail.types.js';

export interface PhotoProximityGroup {
  photos: PhotoWithUrl[];
  startIndex: number;
}

/**
 * Calcula el grupo de fotos GPS-cercanas (<75m) a la foto pulsada en el mapa, ordenadas
 * más reciente primero (mismo orden que la galería/timeline, ver
 * `MemoryPhotoRepository.getByRouteId`), y la posición de esa foto dentro del grupo.
 */
export function groupPhotosByProximity(photos: PhotoWithUrl[], clickedPhotoId: string): PhotoProximityGroup {
  const withCoords = photos.filter((p) => p.latitude != null && p.longitude != null);
  const cluster = clusterPhotos(withCoords, PHOTO_PROXIMITY_GROUP_RADIUS_METERS)
    .find((c) => c.photos.some((p) => p.id === clickedPhotoId));
  const group = cluster?.photos ?? photos.filter((p) => p.id === clickedPhotoId);
  const sorted = [...group].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const startIndex = Math.max(0, sorted.findIndex((p) => p.id === clickedPhotoId));
  return { photos: sorted, startIndex };
}
