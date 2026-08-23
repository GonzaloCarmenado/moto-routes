/**
 * Fila de acceso a "Amigos" (agregar-amigos) desde el perfil — icono +
 * etiqueta + chevron, mismo patrón que `profile-achievements-link.ts`, con
 * un badge numérico de solicitudes de amistad pendientes recibidas (mismo
 * criterio "9+" que `route-list-sharing.ts::buildSharingButton`).
 */
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import { FRIENDS_ICON } from '../shared/icons/friends-icon.js';
import { formatPendingBadge } from '../friends/friends-list.transform.js';

/** Construye la fila "Amigos", con el badge de pendientes recibidas ya resuelto. */
export function buildFriendsLink(pendingCount: number): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'achievements-link';
  btn.setAttribute('data-cy', 'profile-btn-amigos');
  btn.addEventListener('click', () => { dispatchAppEvent(APP_EVENTS.VIEW_FRIENDS); });
  btn.append(buildIcon(), buildLabel(), ...buildBadge(pendingCount), buildChevron());
  return btn;
}

function buildIcon(): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'achievements-link__icon';
  icon.innerHTML = FRIENDS_ICON;
  return icon;
}

function buildLabel(): HTMLElement {
  const label = document.createElement('span');
  label.className = 'achievements-link__label';
  label.textContent = 'Amigos';
  return label;
}

function buildBadge(pendingCount: number): HTMLElement[] {
  const text = formatPendingBadge(pendingCount);
  if (text === null) return [];
  const badge = document.createElement('span');
  badge.className = 'friends-link__badge';
  badge.setAttribute('data-cy', 'profile-amigos-badge');
  badge.textContent = text;
  return [badge];
}

const CHEVRON_ICON = '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';

function buildChevron(): HTMLElement {
  const chevron = document.createElement('span');
  chevron.className = 'achievements-link__chevron';
  chevron.innerHTML = CHEVRON_ICON;
  return chevron;
}
