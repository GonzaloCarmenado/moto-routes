/**
 * Servicio de negocio para fotos en el detalle de ruta.
 * Adapta el pipeline compartido `persistCapturedPhoto` al alta desde una ruta ya
 * guardada: sin `fallbackPoint` individual (usa el centroide de la ruta) y
 * devolviendo además una URL para la vista previa inmediata.
 */

import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { CreatePhoto } from '../../shared/models/photo.types.js';
import type { CaptureResult } from '../../shared/services/photo-capture-adapter.service.js';
import { isTauri } from '../../shared/services/photo-capture-adapter.service.js';
import { persistCapturedPhoto } from '../../shared/services/photo-persist.service.js';

/**
 * Añade una foto a una ruta con persistencia real y devuelve, además del
 * `CreatePhoto` persistido, una URL usable como `src` para mostrarla al momento.
 * Devuelve `null` si el usuario canceló (sin archivo). Lanza `Error` si la foto
 * no es válida o si falla el guardado/persistencia.
 */
export async function addPhotoToRoute(
  file: CaptureResult,
  routeId: string,
  photoRepo: IPhotoRepository,
  routePoints?: { lat: number; lng: number }[],
): Promise<{ photo: CreatePhoto; objectUrl: string } | null> {
  if (!file) return null;

  const photo = await persistCapturedPhoto({
    file,
    routeId,
    photoRepo,
    routePoints: routePoints ?? [],
  });

  // En Tauri usamos un blob URL solo para la vista previa inmediata (el dato
  // persistido es filePath); en navegador filePath ya es un data URL usable.
  const objectUrl = isTauri() ? URL.createObjectURL(file) : photo.filePath;

  return { photo, objectUrl };
}
