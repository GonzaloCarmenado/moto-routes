/**
 * Orquesta la decisión de guardar/descartar tras parar una grabación: muestra
 * el diálogo (no cerrable — parar una ruta obliga a decidir), y aplica la
 * elección: persistir como completed, o borrar la ruta + sus fotos.
 */

import type { RouteMetadata } from './cockpit.types.js';
import type { CockpitService } from './cockpit.service.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import { formatDuration } from './cockpit.transform.js';
import { confirmDialog } from '../shared/feedback/confirm-dialog.element.js';
import { deleteRouteAndPhotos } from '../shared/services/route-deletion.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/feedback/toast.js';

async function decideStopOutcome(metadata: RouteMetadata): Promise<'save' | 'discard'> {
  const choice = await confirmDialog({
    title: '¿Guardar la ruta?',
    message: `${metadata.totalDistance.toFixed(1)} km · ${formatDuration(metadata.duration)}`,
    actions: [
      { id: 'discard', label: 'Descartar', variant: 'danger' },
      { id: 'save', label: 'Guardar', variant: 'primary' },
    ],
    closable: false,
  });
  return choice === 'save' ? 'save' : 'discard';
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
  const choice = await decideStopOutcome(metadata);

  if (choice === 'save') {
    service.confirmSaveRecording();
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
