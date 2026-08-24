/**
 * Botón "Compartir" de `<route-detail>`, junto al icono de sincronización:
 * construcción del DOM y apertura del diálogo. Extraído de
 * route-detail.element.ts para mantener ese archivo bajo el límite de
 * tamaño (specs/ui/frontend-conventions.md), mismo patrón que
 * route-detail-cloud-upload.ts/route-detail-favorite.ts.
 *
 * Solo tiene sentido con sesión activa y una ruta ya sincronizada (el
 * clonado ocurre enteramente en el servidor, ver design.md D2 de
 * `compartir-ruta`) — el llamador (route-detail-header.ts) ya gatea su
 * construcción con ese criterio, igual que "Subir a la nube". Además se
 * deshabilita mientras queden fotos locales sin subir todavía (`disabled`):
 * la subida de fotos es una operación aparte y en segundo plano de la de la
 * ruta (ver route-detail-cloud.service.ts), así que una ruta puede aparecer
 * "sincronizada" mientras sus fotos siguen subiendo — compartir en ese
 * instante clonaría la ruta sin ninguna foto, en silencio (bug real
 * encontrado en producción, ver openspec/specs/compartir-rutas/spec.md).
 */
import type { Session } from '../../shared/models/session.types.js';
import { SHARE_ICON } from '../../shared/icons/share-icon.js';
import { openRouteShareDialog } from './route-share-dialog.element.js';


export interface ShareButtonOptions {
  apiBaseUrl: string;
  session: Session;
  routeId: string;
  disabled: boolean;
}

/** Construye el botón "Compartir" (ver JSDoc del módulo). */
export function buildShareButton(options: ShareButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sync-icon-btn';
  btn.setAttribute('data-cy', 'route-detail-btn-compartir');
  btn.setAttribute('aria-label', options.disabled ? 'Compartir ruta (subiendo fotos todavía)' : 'Compartir ruta');
  btn.disabled = options.disabled;
  btn.innerHTML = SHARE_ICON;
  btn.addEventListener('click', () => {
    void openRouteShareDialog({
      apiBaseUrl: options.apiBaseUrl,
      token: options.session.token,
      routeId: options.routeId,
    });
  });
  return btn;
}
