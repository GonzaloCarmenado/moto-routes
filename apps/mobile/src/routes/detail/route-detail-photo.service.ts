/**
 * Servicio de negocio para fotos en el detalle de ruta.
 * Adapta el pipeline compartido `persistCapturedPhoto` al alta desde una ruta ya
 * guardada: sin `fallbackPoint` individual (usa el centroide de la ruta) y
 * devolviendo además una URL para la vista previa inmediata.
 */

import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Photo } from '../../shared/models/photo.types.js';
import type { CaptureResult } from '../../shared/services/photo-capture-adapter.service.js';
import { isTauri } from '../../shared/services/photo-capture-adapter.service.js';
import { persistCapturedPhoto } from '../../shared/services/photo-persist.service.js';
import { triggerPhotoUpload, type SyncTriggerContext } from './route-detail-sync-triggers.js';
import type { PhotoWithUrl } from './route-detail.types.js';

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
): Promise<{ photo: Photo; objectUrl: string } | null> {
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

/**
 * Refleja en una lista de fotos ya cargada en memoria el `remotePhotoId` que
 * el repositorio tiene para una de ellas -- necesario porque la subida en
 * segundo plano (`uploadPhotoToCloud`) actualiza el repositorio, no ningún
 * array ya cargado antes de que esa subida terminara. Si la foto ya no
 * existe en el repositorio (borrada mientras tanto), devuelve la lista tal
 * cual, sin lanzar.
 */
export async function syncPhotoRemoteState(
  photos: PhotoWithUrl[],
  photoRepo: IPhotoRepository,
  photoId: string,
): Promise<PhotoWithUrl[]> {
  const updated = await photoRepo.getById(photoId);
  if (!updated) return photos;
  return photos.map((p) => (p.id === photoId ? { ...p, remotePhotoId: updated.remotePhotoId } : p));
}

/**
 * Reintenta en segundo plano la subida de las fotos con `remotePhotoId`
 * nulo -- la subida al añadir una foto es de un solo intento
 * (`triggerPhotoUpload`, disparada una vez desde `<route-detail>` al
 * capturarla), así que sin este reintento una foto que falló una vez
 * quedaría huérfana para siempre y bloquearía "Compartir" sin ninguna forma
 * de recuperarse (ver route-detail-share.ts, gap real encontrado en
 * producción). `getPhotos` se re-invoca en cada callback en vez de cerrar
 * sobre un array capturado, para no pisar cambios en `_photos` ocurridos
 * mientras otra foto de la misma tanda seguía subiendo. Fire-and-forget: no
 * bloquea al llamador.
 */
export function retryPendingPhotoUploads(
  getPhotos: () => PhotoWithUrl[],
  ctx: SyncTriggerContext,
  photoRepo: IPhotoRepository,
  onUpdated: (photos: PhotoWithUrl[]) => void,
): void {
  const pending = getPhotos().filter((p) => p.remotePhotoId === null);
  for (const photo of pending) {
    void triggerPhotoUpload(ctx, photoRepo, photo)
      .then(async () => {
        onUpdated(await syncPhotoRemoteState(getPhotos(), photoRepo, photo.id));
      });
  }
}
