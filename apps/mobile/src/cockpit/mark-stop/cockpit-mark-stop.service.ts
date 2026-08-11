/**
 * Orquesta el flujo de marcar una parada manual: abre el modal de tipo con
 * el catálogo cacheado y, si el usuario elige uno, la registra. Extraído de
 * cockpit.element.ts para mantener ese archivo bajo el límite de tamaño
 * (specs/ui/frontend-conventions.md), mismo patrón que stop/cockpit-stop.service.ts.
 */
import type { CockpitService } from '../cockpit.service.js';
import type { IStopTypesCacheRepository } from '../../shared/models/stop-types-cache.repository.js';
import { openStopTypeDialog } from '../stop-type-dialog/cockpit-stop-type-dialog.element.js';
import { showToast } from '../../shared/feedback/toast.js';

/**
 * Abre el modal de tipo de parada con el catálogo cacheado (funciona sin
 * conexión) y, si el usuario elige uno, registra la parada manual en el
 * punto GPS más reciente. Cerrar el modal sin elegir no hace nada.
 */
export async function markStopFlow(service: CockpitService, stopTypesCache: IStopTypesCacheRepository): Promise<void> {
  const categories = await stopTypesCache.getAll();
  const chosen = await openStopTypeDialog(categories);
  if (!chosen) return;
  service.addManualStop(chosen.id);
  // sistema-iconos-svg: sin emoji de categoría en el mensaje — el icono de éxito del propio toast ya lo comunica visualmente.
  showToast(`Parada marcada: ${chosen.label}`, 'success');
}
