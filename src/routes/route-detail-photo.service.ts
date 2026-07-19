/**
 * Servicio de negocio para fotos en el detalle de ruta.
 */

import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { CaptureResult } from '../shared/services/photo-capture-adapter.service.js';
import { validatePhoto } from '../shared/services/photo-capture-adapter.service.js';
import { extractPhotoLocation } from '../shared/services/photo-geolocation.service.js';

/**
 * Convierte un File a base64 data URL para persistencia duradera.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Detecta Tauri.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

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

  let filePath: string;
  let objectUrl: string;

  if (isTauri()) {
    // Android: guardar en appDataDir, obtener ruta del sistema de archivos
    const { savePhotoFile } = await import('../shared/services/photo-storage.service.js');
    filePath = await savePhotoFile(file);
    // Blob URL temporal para visualización inmediata
    objectUrl = URL.createObjectURL(file);
  } else {
    // Web: guardar como base64 data URL (persistente en localStorage)
    filePath = await fileToBase64(file);
    objectUrl = filePath; // data URL se puede usar directamente como src
  }

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