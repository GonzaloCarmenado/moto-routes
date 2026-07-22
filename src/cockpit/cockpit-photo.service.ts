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
import { toErrorMessage } from '../shared/utils/errors.js';
import type { RoutePoint } from '../cockpit/cockpit.types.js';

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
