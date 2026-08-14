/**
 * Botón de acceso a "Invitaciones" en la cabecera de `route-list`, con
 * indicador si hay invitaciones recibidas pendientes. Extraído de
 * route-list.element.ts para mantener ese archivo bajo el límite de tamaño
 * del proyecto, mismo patrón que route-list-favorite.ts.
 */
import type { Session } from '../../shared/models/session.types.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import { fetchReceivedInvitations } from '../../shared/http/route-sharing-api.service.js';
import { SHARE_ICON } from '../../shared/icons/share-icon.js';

/** Construye el botón de acceso a la pantalla de invitaciones. */
export function buildSharingButton(hasPendingReceived: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Reutiliza el mismo estilo de icono redondo que .favorite-icon (mismo
  // criterio ya usado por route-list-favorite.ts: un Shadow DOM no hereda
  // CSS de otro componente, así que la clase se comparte a propósito).
  btn.className = 'favorite-icon';
  btn.classList.toggle('favorite-icon--active', hasPendingReceived);
  btn.setAttribute('data-cy', 'route-list-btn-invitaciones');
  btn.setAttribute('aria-label', hasPendingReceived ? 'Invitaciones (tienes invitaciones pendientes)' : 'Invitaciones');
  btn.innerHTML = SHARE_ICON;
  btn.addEventListener('click', () => { dispatchAppEvent(APP_EVENTS.VIEW_SHARING); });
  return btn;
}

/**
 * Comprueba si hay invitaciones recibidas pendientes, para el indicador del
 * botón — best-effort: sin sesión, o si la petición falla (p. ej. sin
 * conexión), se trata como "sin pendientes" en vez de romper el listado.
 */
export async function hasPendingReceivedInvitations(apiBaseUrl: string, session: Session | null): Promise<boolean> {
  if (!session) return false;
  try {
    const received = await fetchReceivedInvitations(apiBaseUrl, session.token);
    return received.length > 0;
  } catch {
    return false;
  }
}
