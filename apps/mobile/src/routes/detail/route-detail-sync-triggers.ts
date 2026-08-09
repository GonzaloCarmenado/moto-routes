/**
 * Wrappers "fire and forget" de las tres sincronizaciones en segundo plano de
 * `<route-detail>` (re-subida de metadatos, subida de foto, borrado de foto)
 * -- extraídos a funciones puras para mantener `route-detail.element.ts` por
 * debajo de su límite de tamaño y poder testear su guarda (sesión/routeId/
 * repositorio) sin montar el componente completo.
 */

import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Photo } from '../../shared/models/photo.types.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { autoResyncIfNeeded, uploadPhotoToCloud, deletePhotoFromCloud } from './route-detail-cloud.service.js';

/** Estado de `<route-detail>` común a los tres triggers. */
export interface SyncTriggerContext {
  session: Session | null;
  routeId: string | null;
  repository: IRouteRepository | null;
  isSynced: boolean;
}

/** Re-sube en segundo plano una ruta ya sincronizada (ver `autoResyncIfNeeded`). No hace nada sin sesión o repositorio. */
export function triggerAutoResync(ctx: SyncTriggerContext, route: Route): void {
  if (!ctx.session || !ctx.repository) return;
  void autoResyncIfNeeded({
    apiBaseUrl: getApiBaseUrl(),
    session: ctx.session,
    repository: ctx.repository,
    route,
    isSynced: ctx.isSynced,
  });
}

/**
 * Sube en segundo plano una foto recién añadida (ver `uploadPhotoToCloud`).
 * No hace nada sin sesión o routeId. Devuelve la promesa (no solo fire-and-
 * forget) para que el llamador pueda refrescar su estado en memoria cuando
 * termine -- `photoRepo.markPhotoSynced()` actualiza el repositorio, pero no
 * ningún array ya cargado en memoria antes de que la subida terminara.
 */
export function triggerPhotoUpload(ctx: SyncTriggerContext, photoRepo: IPhotoRepository, photo: Photo): Promise<void> {
  if (!ctx.session || !ctx.routeId) return Promise.resolve();
  return uploadPhotoToCloud({
    apiBaseUrl: getApiBaseUrl(),
    session: ctx.session,
    photoRepo,
    routeId: ctx.routeId,
    photo,
    isSynced: ctx.isSynced,
  });
}

/** Borra en segundo plano la copia remota de una foto borrada localmente (ver `deletePhotoFromCloud`). No hace nada sin sesión o routeId. */
export function triggerPhotoDelete(ctx: SyncTriggerContext, remotePhotoId: string | null): void {
  if (!ctx.session || !ctx.routeId) return;
  void deletePhotoFromCloud({
    apiBaseUrl: getApiBaseUrl(),
    session: ctx.session,
    routeId: ctx.routeId,
    remotePhotoId,
    isSynced: ctx.isSynced,
  });
}
