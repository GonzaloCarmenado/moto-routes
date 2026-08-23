/**
 * Construcción de los tres paneles de `<friends-view>` (Amigos/Recibidas/
 * Enviadas) — extraído de `friends-view.element.ts` por límite de líneas
 * del proyecto (`eslint.config.js`, `max-lines`), mismo patrón de
 * extracción ya usado en `profile-header.ts`/`route-detail-notes.ts`.
 */
import type { Friend, ReceivedFriendRequest, SentFriendRequest } from '../shared/models/friends.types.js';

const STATUS_LABEL: Record<SentFriendRequest['status'], string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  declined: 'Rechazada',
  revoked: 'Revocada',
};

interface ActionButtonOptions {
  className: string;
  dataCy: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** Botón de acción de una tarjeta (aceptar/rechazar/revocar). */
export function buildActionButton(options: ActionButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = options.className;
  btn.setAttribute('data-cy', options.dataCy);
  btn.textContent = options.label;
  btn.disabled = options.disabled;
  btn.addEventListener('click', options.onClick);
  return btn;
}

function buildEmpty(dataCy: string, text: string): HTMLElement {
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.setAttribute('data-cy', dataCy);
  empty.textContent = text;
  return empty;
}

/** Panel "Amigos": lista de amistades ya aceptadas, identificadas por username. */
export function buildFriendsPanel(friends: Friend[]): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.slot = 'friends-amigos';

  if (friends.length === 0) {
    panel.appendChild(buildEmpty('friends-empty-amigos', 'Todavía no tienes ningún amigo'));
    return panel;
  }

  for (const friend of friends) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-cy', 'friends-card-amigo');
    const nameEl = document.createElement('p');
    nameEl.className = 'card-name';
    nameEl.textContent = friend.username;
    card.appendChild(nameEl);
    panel.appendChild(card);
  }
  return panel;
}

/** Panel "Recibidas": solicitudes pendientes recibidas, con aceptar/rechazar. */
export function buildReceivedPanel(
  received: ReceivedFriendRequest[],
  busyId: string | null,
  onAccept: (requestId: string) => void,
  onDecline: (requestId: string) => void,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.slot = 'friends-recibidas';

  if (received.length === 0) {
    panel.appendChild(buildEmpty('friends-empty-recibidas', 'No tienes solicitudes de amistad pendientes'));
    return panel;
  }

  for (const req of received) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-cy', 'friends-card-recibida');
    const nameEl = document.createElement('p');
    nameEl.className = 'card-name';
    nameEl.textContent = req.fromUsername;
    card.appendChild(nameEl);

    const busy = busyId === req.id;
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.appendChild(buildActionButton({
      className: 'action action--primary', dataCy: 'friends-btn-aceptar', label: 'Aceptar', disabled: busy,
      onClick: () => { onAccept(req.id); },
    }));
    actions.appendChild(buildActionButton({
      className: 'action', dataCy: 'friends-btn-rechazar', label: 'Rechazar', disabled: busy,
      onClick: () => { onDecline(req.id); },
    }));
    card.appendChild(actions);
    panel.appendChild(card);
  }
  return panel;
}

function buildSentCard(req: SentFriendRequest, busyId: string | null, onRevoke: (requestId: string) => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-cy', 'friends-card-enviada');
  const nameEl = document.createElement('p');
  nameEl.className = 'card-name';
  nameEl.textContent = req.toUsername;
  card.appendChild(nameEl);

  const status = document.createElement('p');
  status.className = `card-status card-status--${req.status}`;
  status.setAttribute('data-cy', 'friends-status');
  status.textContent = STATUS_LABEL[req.status];
  card.appendChild(status);

  if (req.status === 'pending') {
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.appendChild(buildActionButton({
      className: 'action action--danger', dataCy: 'friends-btn-revocar', label: 'Revocar', disabled: busyId === req.id,
      onClick: () => { onRevoke(req.id); },
    }));
    card.appendChild(actions);
  }

  return card;
}

/** Panel "Enviadas": solicitudes enviadas con su estado, revocar solo las pendientes. */
export function buildSentPanel(sent: SentFriendRequest[], busyId: string | null, onRevoke: (requestId: string) => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.slot = 'friends-enviadas';

  if (sent.length === 0) {
    panel.appendChild(buildEmpty('friends-empty-enviadas', 'No has enviado ninguna solicitud de amistad todavía'));
    return panel;
  }

  for (const req of sent) {
    panel.appendChild(buildSentCard(req, busyId, onRevoke));
  }
  return panel;
}
