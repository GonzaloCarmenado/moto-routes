/**
 * Pipeline compartido de persistencia de una foto de ruta:
 * validar → geolocalizar → guardar archivo → construir metadatos → persistir.
 *
 * Es el núcleo común detrás de la captura en el cockpit (grabación activa) y del
 * alta desde el detalle de ruta. Cada llamador adapta la entrada/salida (callbacks
 * vs return, y de dónde sale el punto de fallback) pero la lógica es una sola.
 */

import type { IPhotoRepository } from '../models/photo.repository.js';
import type { CreatePhoto, Photo } from '../models/photo.types.js';
import { validatePhoto } from './photo-capture-adapter.service.js';
import { extractPhotoLocation } from './photo-geolocation.service.js';
import { savePhotoFile } from './photo-storage.service.js';

/** Parámetros del pipeline de persistencia de una foto capturada. */
export interface PersistCapturedPhotoParams {
  file: File;
  routeId: string;
  photoRepo: IPhotoRepository;
  /** Punto de fallback individual (p. ej. último punto de la ruta activa en el cockpit). */
  fallbackPoint?: { lat: number; lng: number } | undefined;
  /** Puntos de la ruta para el centroide, si no hay GPS en EXIF ni `fallbackPoint`. */
  routePoints: { lat: number; lng: number }[];
}

/**
 * Ejecuta el pipeline y devuelve la entidad `Photo` ya persistida (con su
 * `id` real asignado por el repositorio, no solo los metadatos de entrada --
 * necesario para poder subirla al backend de fotos más adelante).
 * Lanza `Error` si la validación falla (formato/tamaño) o si falla el guardado
 * del archivo o la persistencia en BBDD — el llamador decide cómo mostrarlo.
 */
export async function persistCapturedPhoto(params: PersistCapturedPhotoParams): Promise<Photo> {
  const { file, routeId, photoRepo, fallbackPoint, routePoints } = params;

  const validationError = validatePhoto(file);
  if (validationError) throw new Error(validationError);

  const location = await extractPhotoLocation(file, fallbackPoint, routePoints);
  const filePath = await savePhotoFile(file);

  const photo: CreatePhoto = {
    routeId,
    filePath,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    capturedAt: new Date().toISOString(),
  };
  return photoRepo.add(photo);
}
