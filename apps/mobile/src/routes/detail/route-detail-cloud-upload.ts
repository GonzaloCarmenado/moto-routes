/**
 * Icono "Subir a la nube" / "Ya sincronizada" de <route-detail>, junto al
 * título: construcción del DOM y manejo del click. Extraído de
 * route-detail.element.ts para mantener ese archivo bajo el límite de
 * tamaño (specs/ui/frontend-conventions.md).
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import { showToast } from '../../shared/feedback/toast.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { uploadRouteToCloud } from './route-detail-cloud.service.js';
import type { UploadedRoutePoint } from '../../shared/http/route-cloud-api.service.js';
import { CLOUD_UPLOAD_ICON, CLOUD_CHECK_ICON } from '../../shared/icons/cloud-sync-icons.js';

interface SyncIconOptions {
  apiBaseUrl: string;
  session: Session;
  repository: IRouteRepository;
  route: Route;
  /** Decide el icono (nube-subir / nube-check, ver design.md Decisión 7) —
   * ambos estados siguen siendo pulsables, para poder forzar una re-subida
   * manual de una ruta ya sincronizada. */
  isSynced: boolean;
  /** Invocado tras una subida manual con éxito, con los puntos resultantes
   * que devolvió el servidor (ajustados a carretera si se normalizaron) —
   * para que el llamador actualice su propio estado (`_isSynced`, mapa) y
   * vuelva a renderizar (ver actualizar-mapa-tras-normalizacion). */
  onUploaded: (points: UploadedRoutePoint[]) => void;
}

/** El llamador solo debe construir este icono con sesión activa y una ruta
 * de origen local (ver route-detail.element.ts) — sin ninguna de las dos, la
 * acción no tiene sentido. */
export function buildSyncIconButton(options: SyncIconOptions): HTMLButtonElement {
  const { isSynced } = options;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sync-icon-btn';
  btn.classList.toggle('sync-icon-btn--synced', isSynced);
  btn.setAttribute('data-cy', 'route-detail-btn-subir-nube');
  btn.setAttribute('aria-label', isSynced ? 'Volver a subir a la nube' : 'Subir a la nube');
  btn.innerHTML = isSynced ? CLOUD_CHECK_ICON : CLOUD_UPLOAD_ICON;
  btn.addEventListener('click', () => {
    void handleUpload(options, btn);
  });
  return btn;
}

async function handleUpload(options: SyncIconOptions, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    const points = await uploadRouteToCloud(options.apiBaseUrl, options.session, options.repository, options.route);
    showToast('Ruta subida a la nube', 'success');
    options.onUploaded(points);
  } catch (err) {
    showToast(toErrorMessage(err, 'Error al subir la ruta'), 'error');
  } finally {
    btn.disabled = false;
  }
}
