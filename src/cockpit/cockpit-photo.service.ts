/**
 * Servicio de negocio para fotos en el cockpit (grabación activa).
 * Adapta el pipeline compartido `persistCapturedPhoto` a la interfaz de callbacks
 * que usa `<cockpit-view>` (onSuccess/onError/onCancel), aportando como punto de
 * fallback el último punto GPS de la ruta en curso.
 */

import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { CaptureResult } from '../shared/services/photo-capture-adapter.service.js';
import { persistCapturedPhoto } from '../shared/services/photo-persist.service.js';
import { getPhotoUrl } from '../shared/services/photo-storage.service.js';
import { deletePhotoWithConfirmation } from '../shared/services/photo-delete.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import type { RoutePoint } from '../cockpit/cockpit.types.js';
import type { GalleryPhoto } from '../shared/photo-gallery/photo-gallery.element.js';

export interface PhotoCaptureCallbacks {
  onSuccess: (photo: CreatePhoto) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

export interface ProcessPhotoCaptureParams {
  file: CaptureResult;
  routeId: string;
  photoRepo: IPhotoRepository;
  lastPoint: RoutePoint | null;
  routePoints: { lat: number; lng: number }[];
  callbacks: PhotoCaptureCallbacks;
}

/**
 * Procesa la captura de una foto durante la grabación de una ruta. Si no hay
 * archivo (cancelación), notifica `onCancel`; en cualquier fallo del pipeline
 * (validación, guardado o persistencia) notifica `onError` con el mensaje real.
 */
export async function processPhotoCapture(params: ProcessPhotoCaptureParams): Promise<void> {
  const { file, routeId, photoRepo, lastPoint, routePoints, callbacks } = params;
  if (!file) {
    callbacks.onCancel?.();
    return;
  }

  const fallbackPoint = lastPoint
    ? { lat: lastPoint.lat, lng: lastPoint.lng }
    : undefined;

  try {
    const photo = await persistCapturedPhoto({ file, routeId, photoRepo, fallbackPoint, routePoints });
    callbacks.onSuccess(photo);
  } catch (err) {
    callbacks.onError(toErrorMessage(err, 'Error al añadir la foto'));
  }
}

export interface ProcessMultiplePhotosParams {
  files: File[];
  routeId: string;
  photoRepo: IPhotoRepository;
  lastPoint: RoutePoint | null;
  routePoints: { lat: number; lng: number }[];
  onError: (error: string) => void;
}

/**
 * Procesa varias fotos en secuencia (p.ej. selección múltiple desde galería) y
 * devuelve cuántas se guardaron de verdad. Cada fallo individual se notifica vía
 * `onError` sin detener el resto de fotos pendientes.
 */
export async function processMultiplePhotos(params: ProcessMultiplePhotosParams): Promise<number> {
  let addedCount = 0;
  for (const file of params.files) {
    await processPhotoCapture({
      file,
      routeId: params.routeId,
      photoRepo: params.photoRepo,
      lastPoint: params.lastPoint,
      routePoints: params.routePoints,
      callbacks: {
        onSuccess: () => { addedCount += 1; },
        onError: params.onError,
      },
    });
  }
  return addedCount;
}

/** Fotos de una ruta con su URL ya resuelta, listas para `<photo-gallery>`. */
export async function fetchGalleryPhotos(photoRepo: IPhotoRepository, routeId: string): Promise<GalleryPhoto[]> {
  const photos = await photoRepo.getByRouteId(routeId);
  return Promise.all(photos.map(async (p) => ({ id: p.id, objectUrl: await getPhotoUrl(p.filePath) })));
}

/** Busca la foto por id y, si existe, pide confirmación y la borra. Devuelve si se borró de verdad. */
export async function deleteCockpitPhoto(photoId: string, photoRepo: IPhotoRepository): Promise<boolean> {
  const photo = await photoRepo.getById(photoId);
  if (!photo) return false;
  return (await deletePhotoWithConfirmation(photo, photoRepo)) === 'deleted';
}
