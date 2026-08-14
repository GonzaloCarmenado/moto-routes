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
 * construcción con ese criterio, igual que "Subir a la nube".
 */
import type { Session } from '../../shared/models/session.types.js';
import { SHARE_ICON } from '../../shared/icons/share-icon.js';
import { openRouteShareDialog } from './route-share-dialog.element.js';

export interface ShareButtonOptions {
  apiBaseUrl: string;
  session: Session;
  routeId: string;
}

/** Construye el botón "Compartir" (ver JSDoc del módulo). */
export function buildShareButton(options: ShareButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sync-icon-btn';
  btn.setAttribute('data-cy', 'route-detail-btn-compartir');
  btn.setAttribute('aria-label', 'Compartir ruta');
  btn.innerHTML = SHARE_ICON;
  btn.addEventListener('click', () => {
    void openRouteShareDialog({
      apiBaseUrl: options.apiBaseUrl,
      token: options.session.token,
      routeId: options.routeId,
      ownEmail: options.session.email,
    });
  });
  return btn;
}
