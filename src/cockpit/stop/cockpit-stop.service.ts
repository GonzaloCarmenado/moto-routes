/**
 * Orquesta la decisión de guardar/descartar tras parar una grabación: muestra
 * el diálogo (no cerrable — parar una ruta obliga a decidir), y aplica la
 * elección: persistir como completed, o borrar la ruta + sus fotos.
 */

import type { RouteMetadata } from '../cockpit.types.js';
import type { CockpitService } from '../cockpit.service.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import { sanitizeRouteName } from '../cockpit.transform.js';
import { formatDuration } from '../../shared/utils/format.js';
import { buildDefaultRouteName } from '../../shared/utils/route-naming.js';
import { openSaveRouteDialog } from '../save-route-dialog/cockpit-save-route-dialog.element.js';
import { deleteRouteAndPhotos } from '../../shared/services/route-deletion.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { showToast } from '../../shared/feedback/toast.js';

interface StopOutcome {
  choice: 'save' | 'discard';
  /** Nombre final ya saneado (trim + límite de 100) y con el fallback de fecha/hora
   * aplicado si el usuario no escribió ninguno (AC-002, AC-003, AC-009). Solo tiene
   * sentido cuando choice === 'save' — se calcula siempre por simplicidad, pero el
   * llamador lo descarta en la rama de "discard" (AC-008). */
  name: string;
}

async function decideStopOutcome(metadata: RouteMetadata): Promise<StopOutcome> {
  const result = await openSaveRouteDialog({
    message: `${metadata.totalDistance.toFixed(1)} km · ${formatDuration(metadata.duration)}`,
  });
  const sanitized = sanitizeRouteName(result.name);
  const name = sanitized || buildDefaultRouteName(metadata.date);
  return { choice: result.action, name };
}

export interface ResolveStopDecisionParams {
  metadata: RouteMetadata;
  routeId: string;
  service: Pick<CockpitService, 'confirmSaveRecording' | 'discardStop'>;
  routeRepo: IRouteRepository;
  /** Perezoso: solo se resuelve si el usuario elige descartar (no retrasa la apertura del diálogo). */
  getPhotoRepo: () => Promise<IPhotoRepository>;
}

export async function resolveStopDecision(params: ResolveStopDecisionParams): Promise<void> {
  const { metadata, routeId, service, routeRepo, getPhotoRepo } = params;
  const { choice, name } = await decideStopOutcome(metadata);

  if (choice === 'save') {
    service.confirmSaveRecording(name);
    showToast('Ruta guardada', 'success');
    return;
  }

  // Indicador de progreso (AC-010): borrar la ruta y sus fotos es async (BBDD +
  // archivos) — el dismiss se llama en cuanto se sepa el resultado, sin esperar
  // a su propio plazo.
  const dismissProgress = showToast('Descartando ruta…', 'info');
  try {
    const photoRepo = await getPhotoRepo();
    await deleteRouteAndPhotos(routeRepo, photoRepo, routeId);
  } catch (err) {
    dismissProgress();
    showToast(`⚠️ ${toErrorMessage(err, 'Error al descartar la ruta')}`, 'error');
    service.discardStop();
    return;
  }
  dismissProgress();
  service.discardStop();
  showToast('Ruta descartada', 'success');
}
