/**
 * Borra una ruta junto con todas sus fotos asociadas.
 *
 * No basta con `routeRepo.delete(routeId)`: en SQLite el ON DELETE CASCADE de
 * `photos` solo actúa si `foreign_keys` está activo en esa conexión (ver el
 * pragma en SqliteRouteRepository), y en el repositorio en memoria (usado en
 * navegador/tests) las fotos viven en un store completamente aparte que no
 * cascada nada por sí solo. Este helper es la única vía de borrado que
 * garantiza el mismo resultado en ambos backends.
 */

import type { IRouteRepository } from '../models/route.repository.js';
import type { IPhotoRepository } from '../models/photo.repository.js';
import { deletePhotoFile } from './photo-storage.service.js';

export async function deleteRouteAndPhotos(
  routeRepo: IRouteRepository,
  photoRepo: IPhotoRepository,
  routeId: string,
): Promise<void> {
  const photos = await photoRepo.getByRouteId(routeId);
  for (const photo of photos) {
    await deletePhotoFile(photo.filePath);
    await photoRepo.delete(photo.id);
  }
  await routeRepo.delete(routeId);
}
