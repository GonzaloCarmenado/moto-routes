/**
 * Servicio de negocio para fotos en el detalle de ruta.
 */

import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { CaptureResult } from '../shared/services/photo-capture-adapter.service.js';
import { validatePhoto, isTauri } from '../shared/services/photo-capture-adapter.service.js';
import { extractPhotoLocation } from '../shared/services/photo-geolocation.service.js';
import { savePhotoFile } from '../shared/services/photo-storage.service.js';

/**
 * Añade una foto a una ruta con persistencia real.
 * - Android: guarda archivo en appDataDir (ruta persistente), metadata en SQLite
 * - Web: guarda foto como base64 data URL en MemoryPhotoRepository (localStorage)
 */
export async function addPhotoToRoute(
  file: CaptureResult,
  routeId: string,
  photoRepo: IPhotoRepository,
  routePoints?: { lat: number; lng: number }[],
): Promise<{ photo: CreatePhoto; objectUrl: string } | null> {
  if (!file) return null;

  const error = validatePhoto(file);
  if (error) throw new Error(error);

  const location = await extractPhotoLocation(file, undefined, routePoints);

  // savePhotoFile ya persiste de forma duradera: appDataDir en Tauri, base64 en navegador
  const filePath = await savePhotoFile(file);
  // En Tauri usamos un blob URL solo para la vista previa inmediata (el dato persistido es filePath);
  // en navegador filePath ya es un data URL directamente usable como src.
  const objectUrl = isTauri() ? URL.createObjectURL(file) : filePath;

  const photo: CreatePhoto = {
    routeId,
    filePath,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    capturedAt: new Date().toISOString(),
  };

  await photoRepo.add(photo);
  return { photo, objectUrl };
}