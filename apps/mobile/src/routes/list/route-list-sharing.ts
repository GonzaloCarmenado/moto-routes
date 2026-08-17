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

/** A partir de este número el badge muestra "9+" en vez del valor exacto, para no romper el hitbox del icono. */
const BADGE_MAX_EXACT = 9;

/**
 * Construye el botón de acceso a la pantalla de invitaciones, con un badge
 * numérico de invitaciones recibidas pendientes (mejoras de visibilidad,
 * contador-invitaciones-pendientes) — sin badge si `pendingCount` es 0.
 */
export function buildSharingButton(pendingCount: number): HTMLButtonElement {
  const hasPendingReceived = pendingCount > 0;
  const btn = document.createElement('button');
  btn.type = 'button';
  // Reutiliza el mismo estilo de icono redondo que .favorite-icon (mismo
  // criterio ya usado por route-list-favorite.ts: un Shadow DOM no hereda
  // CSS de otro componente, así que la clase se comparte a propósito).
  btn.className = 'favorite-icon';
  btn.classList.toggle('favorite-icon--active', hasPendingReceived);
  btn.setAttribute('data-cy', 'route-list-btn-invitaciones');
  btn.setAttribute('aria-label', hasPendingReceived ? `Invitaciones (${String(pendingCount)} pendientes)` : 'Invitaciones');
  btn.innerHTML = SHARE_ICON;
  btn.addEventListener('click', () => { dispatchAppEvent(APP_EVENTS.VIEW_SHARING); });
  if (hasPendingReceived) btn.appendChild(buildPendingBadge(pendingCount));
  return btn;
}

function buildPendingBadge(pendingCount: number): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'invitaciones-badge';
  badge.setAttribute('data-cy', 'route-list-invitaciones-badge');
  badge.textContent = pendingCount > BADGE_MAX_EXACT ? `${String(BADGE_MAX_EXACT)}+` : String(pendingCount);
  return badge;
}

/**
 * Recuento de invitaciones recibidas pendientes, para el badge del botón —
 * best-effort: sin sesión, o si la petición falla (p. ej. sin conexión), se
 * trata como "0 pendientes" en vez de romper el listado.
 */
export async function hasPendingReceivedInvitations(apiBaseUrl: string, session: Session | null): Promise<number> {
  if (!session) return 0;
  try {
    const received = await fetchReceivedInvitations(apiBaseUrl, session.token);
    return received.length;
  } catch {
    return 0;
  }
}
