/**
 * Servicio de negocio para fotos en el detalle de ruta.
 */

import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { CaptureResult } from '../shared/services/photo-capture-adapter.service.js';
import { validatePhoto } from '../shared/services/photo-capture-adapter.service.js';
import { extractPhotoLocation } from '../shared/services/photo-geolocation.service.js';

export async function addPhotoToRoute(
  file: CaptureResult,
  routeId: string,
  photoRepo: IPhotoRepository,
  routePoints?: { lat: number; lng: number }[],
): Promise<CreatePhoto | null> {
  if (!file) return null;

  const error = validatePhoto(file);
  if (error) throw new Error(error);

  const location = await extractPhotoLocation(file, undefined, routePoints);

  const photo: CreatePhoto = {
    routeId,
    filePath: `photos/${crypto.randomUUID()}-${file.name}`,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    capturedAt: new Date().toISOString(),
  };

  await photoRepo.add(photo);
  return photo;
}