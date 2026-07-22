/**
 * Servicio de negocio para fotos en el cockpit (grabación activa).
 * Orquesta: captura de imagen → geolocalización → persistencia.
 */

import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { CaptureResult } from '../shared/services/photo-capture-adapter.service.js';
import { validatePhoto } from '../shared/services/photo-capture-adapter.service.js';
import { extractPhotoLocation } from '../shared/services/photo-geolocation.service.js';
import { savePhotoFile } from '../shared/services/photo-storage.service.js';
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
 * Procesa la captura de una foto durante la grabación de una ruta:
 * 1. Valida formato y tamaño
 * 2. Extrae ubicación GPS (EXIF → último punto → null)
 * 3. Persiste en repositorio
 * 4. Notifica resultado
 */
export async function processPhotoCapture(params: ProcessPhotoCaptureParams): Promise<void> {
  const { file, routeId, photoRepo, lastPoint, routePoints, callbacks } = params;
  if (!file) {
    callbacks.onCancel?.();
    return;
  }

  // 1. Validar
  const error = validatePhoto(file);
  if (error) {
    callbacks.onError(error);
    return;
  }

  // 2. Geolocalizar
  const fallbackPoint = lastPoint
    ? { lat: lastPoint.lat, lng: lastPoint.lng }
    : undefined;
  const location = await extractPhotoLocation(file, fallbackPoint, routePoints);

  // 3. Guardar el archivo (appDataDir en Tauri, base64 en navegador)
  let filePath: string;
  try {
    filePath = await savePhotoFile(file);
  } catch (err) {
    callbacks.onError(toErrorMessage(err, 'Error al guardar la foto'));
    return;
  }

  // 4. Crear registro y persistir metadatos
  const photo: CreatePhoto = {
    routeId,
    filePath,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    capturedAt: new Date().toISOString(),
  };

  try {
    await photoRepo.add(photo);
  } catch (err) {
    callbacks.onError(toErrorMessage(err, 'Error al persistir la foto'));
    return;
  }

  // 5. Notificar
  callbacks.onSuccess(photo);
}