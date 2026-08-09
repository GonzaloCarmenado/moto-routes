import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route, RoutePoint, RouteStop } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Photo } from '../../shared/models/photo.types.js';
import { uploadRoute, fetchCloudRouteDetail, fetchCloudRoutes } from '../../shared/http/route-cloud-api.service.js';
import { uploadRoutePhoto, deleteRoutePhoto } from '../../shared/http/photo-cloud-api.service.js';
import { readPhotoBlob } from '../../shared/services/photo-storage.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { showToast } from '../../shared/feedback/toast.js';
import { cloudRouteDetailToLocal } from './route-detail-cloud.transform.js';

/**
 * Sube (o actualiza, upsert por id) una ruta local completa a la cuenta del
 * usuario autenticado — sus puntos y paradas se leen del repositorio local
 * en el momento de subir, no se guardan aparte.
 */
export async function uploadRouteToCloud(
  apiBaseUrl: string,
  session: Session,
  repository: IRouteRepository,
  route: Route,
): Promise<void> {
  const [points, stops] = await Promise.all([
    repository.getPointsByRouteId(route.id),
    repository.getStopsByRouteId(route.id),
  ]);
  await uploadRoute(apiBaseUrl, session.token, { route, points, stops });
}

/** Parámetros de {@link autoResyncIfNeeded}, agrupados por `max-params`. */
export interface AutoResyncOptions {
  apiBaseUrl: string;
  session: Session;
  repository: IRouteRepository;
  route: Route;
  isSynced: boolean;
}

/**
 * Re-sube en segundo plano una ruta que ya estaba sincronizada tras un
 * cambio local (nota o foto) — sin acción explícita del usuario. Sin toast
 * de éxito (para no ser ruidoso en una acción secundaria que el usuario no
 * ha pedido), pero con un aviso discreto si falla; nunca revierte el cambio
 * local ya guardado (ver design.md Decisión 10 / spec `route-cloud-sync`).
 * No hace nada si la ruta todavía no estaba sincronizada — esta función
 * nunca sube una ruta puramente local por primera vez.
 */
export async function autoResyncIfNeeded(options: AutoResyncOptions): Promise<void> {
  if (!options.isSynced) return;
  try {
    await uploadRouteToCloud(options.apiBaseUrl, options.session, options.repository, options.route);
  } catch (err) {
    showToast(`⚠️ ${toErrorMessage(err, 'No se pudo actualizar la ruta en la nube')}`, 'error');
  }
}

/**
 * Comprueba si una ruta local ya existe también en la cuenta del usuario —
 * `IRouteRepository` no guarda ningún estado de sincronización propio, así
 * que se consulta el resumen real de la nube (mismo criterio que usa el
 * listado para fusionar). Nunca lanza: un fallo de red se trata como "no
 * sincronizada" — degradación segura, ver design.md Decisión 8.
 */
export async function checkIfRouteIsSynced(apiBaseUrl: string, session: Session, routeId: string): Promise<boolean> {
  try {
    const cloud = await fetchCloudRoutes(apiBaseUrl, session.token);
    return cloud.some((r) => r.id === routeId);
  } catch {
    return false;
  }
}

/** Ruta descargada de la nube, adaptada a los tipos locales. */
export interface CloudRouteLoaded {
  route: Route;
  points: RoutePoint[];
  stops: RouteStop[];
  error?: undefined;
}

/** Fallo al descargar el detalle (p. ej. sin conexión). */
export interface CloudRouteLoadFailed {
  error: string;
}

/**
 * Descarga el detalle completo de una ruta exclusiva de la nube (no existe
 * en el repositorio local) para renderizarla con el mismo mapa/timeline que
 * una ruta local. Nunca lanza: un fallo (red, 404) se devuelve como
 * `CloudRouteLoadFailed` para que el llamador muestre un mensaje explícito
 * en vez de dejar la pantalla en blanco.
 */
export async function loadCloudRouteDetail(
  apiBaseUrl: string,
  session: Session,
  routeId: string,
): Promise<CloudRouteLoaded | CloudRouteLoadFailed> {
  try {
    const detail = await fetchCloudRouteDetail(apiBaseUrl, session.token, routeId);
    return cloudRouteDetailToLocal(detail);
  } catch (err) {
    return { error: toErrorMessage(err, 'Error al cargar la ruta de la nube') };
  }
}

/** Parámetros de {@link uploadPhotoToCloud}, agrupados por `max-params`. */
export interface UploadPhotoToCloudOptions {
  apiBaseUrl: string;
  session: Session;
  photoRepo: IPhotoRepository;
  routeId: string;
  photo: Photo;
  isSynced: boolean;
}

/**
 * Sube en segundo plano el archivo de una foto recién añadida a una ruta ya
 * sincronizada, y marca su id remoto en el repositorio local para que un
 * borrado posterior pueda referenciarla (ver design.md Decisión 5). No hace
 * nada si la ruta no está sincronizada. Nunca lanza: un fallo (sin conexión,
 * límite del servidor) se queda como "no sincronizada" con un aviso
 * discreto, sin revertir el guardado local ya confirmado.
 */
export async function uploadPhotoToCloud(options: UploadPhotoToCloudOptions): Promise<void> {
  if (!options.isSynced) return;
  try {
    const blob = await readPhotoBlob(options.photo.filePath);
    const filename = options.photo.filePath.split('/').pop() ?? `${options.photo.id}.jpg`;
    const uploaded = await uploadRoutePhoto(options.apiBaseUrl, options.session.token, options.routeId, {
      file: blob,
      filename,
      latitude: options.photo.latitude,
      longitude: options.photo.longitude,
      capturedAt: options.photo.capturedAt,
    });
    await options.photoRepo.markPhotoSynced(options.photo.id, uploaded.id);
  } catch (err) {
    showToast(`⚠️ ${toErrorMessage(err, 'No se pudo subir la foto a la nube')}`, 'error');
  }
}

/** Parámetros de {@link deletePhotoFromCloud}, agrupados por `max-params`. */
export interface DeletePhotoFromCloudOptions {
  apiBaseUrl: string;
  session: Session;
  routeId: string;
  remotePhotoId: string | null;
  isSynced: boolean;
}

/**
 * Borra en segundo plano la copia remota de una foto borrada localmente de
 * una ruta ya sincronizada. No hace ninguna llamada de red si la ruta no
 * está sincronizada o la foto nunca llegó a subirse (`remotePhotoId` nulo).
 * Nunca lanza: un fallo se queda con un aviso discreto, sin afectar al
 * borrado local (que ya ha tenido éxito).
 */
export async function deletePhotoFromCloud(options: DeletePhotoFromCloudOptions): Promise<void> {
  if (!options.isSynced || options.remotePhotoId === null) return;
  try {
    await deleteRoutePhoto(options.apiBaseUrl, options.session.token, options.routeId, options.remotePhotoId);
  } catch (err) {
    showToast(`⚠️ ${toErrorMessage(err, 'No se pudo borrar la foto de la nube')}`, 'error');
  }
}
