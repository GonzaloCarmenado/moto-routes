import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import {
  sendFriendRequest,
  listReceivedRequests,
  listSentRequests,
  listFriends,
  acceptFriendRequest,
  declineFriendRequest,
  revokeFriendRequest,
} from '../shared/http/friends-api.service.js';
import type * as FriendsApiService from '../shared/http/friends-api.service.js';
import { fetchCurrentUser } from '../auth/auth-api.service.js';
import type * as AuthApiService from '../auth/auth-api.service.js';
import { FRIEND_SELECTOR_SELECTED_EVENT } from '../shared/friend-selector/friend-selector.element.js';
import './friends-view.element.js';

vi.mock('../shared/http/friends-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof FriendsApiService>();
  return {
    ...actual,
    sendFriendRequest: vi.fn().mockResolvedValue(undefined),
    listReceivedRequests: vi.fn().mockResolvedValue([]),
    listSentRequests: vi.fn().mockResolvedValue([]),
    listFriends: vi.fn().mockResolvedValue([]),
    acceptFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
    revokeFriendRequest: vi.fn(),
  };
});

vi.mock('../auth/auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return {
    ...actual,
    fetchCurrentUser: vi.fn().mockResolvedValue({ id: 1, email: 'me@example.com', emailVerified: true, username: 'me' }),
  };
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mountWithSession(): Promise<{ el: HTMLElement; root: ShadowRoot; sessionRepository: MemorySessionRepository }> {
  const sessionRepository = new MemorySessionRepository();
  await sessionRepository.save({ token: 'jwt-token', email: 'me@example.com' });

  const el = document.createElement('friends-view') as HTMLElement & { sessionRepository: MemorySessionRepository };
  document.body.appendChild(el);
  el.sessionRepository = sessionRepository;
  await flush();

  return { el, root: el.shadowRoot!, sessionRepository };
}

/**
 * Simula la selección de un candidato en `<friend-selector>` despachando su
 * evento de selección directamente sobre el elemento, sin conducir su propio
 * flujo interno de búsqueda con debounce (ya cubierto por los tests propios
 * de `friend-selector.element.spec.ts`) — este spec solo verifica que
 * `friends-view` reacciona correctamente al evento del contrato.
 */
function selectFriend(root: ShadowRoot, username: string): void {
  const selector = root.querySelector('friend-selector')!;
  selector.dispatchEvent(new CustomEvent(FRIEND_SELECTOR_SELECTED_EVENT, { detail: { username }, bubbles: true, composed: true }));
}

describe('friends-view', () => {
  afterEach(() => {
    document.body.querySelectorAll('friends-view').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('shows the empty state for friends, received and sent requests when there are none', async () => {
    const { root } = await mountWithSession();

    expect(root.querySelector('[data-cy="friends-empty-amigos"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="friends-empty-recibidas"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="friends-empty-enviadas"]')).not.toBeNull();
  });

  it('lists accepted friends by username', async () => {
    vi.mocked(listFriends).mockResolvedValue([{ username: 'friend1' }]);

    const { root } = await mountWithSession();

    const card = root.querySelector('[data-cy="friends-card-amigo"]');
    expect(card?.textContent).toContain('friend1');
  });

  it('sending a friend request by the username selected in friend-selector calls sendFriendRequest', async () => {
    const { root } = await mountWithSession();
    selectFriend(root, 'friend1');

    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-enviar"]')!.click();
    await flush();

    expect(sendFriendRequest).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'friend1');
  });

  it('sending a request to the own username is rejected on the client as defense in depth, without calling sendFriendRequest', async () => {
    const { root } = await mountWithSession();
    // El propio <friend-selector> ya excluye la cuenta propia de sus
    // resultados (excludeUsername) — este evento simula que llegara igual,
    // para probar la defensa en profundidad de friends-view (tasks.md 5.2).
    selectFriend(root, 'me');

    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-enviar"]')!.click();
    await flush();

    expect(sendFriendRequest).not.toHaveBeenCalled();
    expect(root.querySelector('[data-cy="friends-send-error"]')?.textContent).toContain('a ti mismo');
  });

  it('a network failure while sending a request shows an inline error and re-enables the send button', async () => {
    vi.mocked(sendFriendRequest).mockRejectedValue(new Error('Network error'));

    const { root } = await mountWithSession();
    selectFriend(root, 'friend1');

    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-enviar"]')!.click();
    await flush();

    expect(root.querySelector('[data-cy="friends-send-error"]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-enviar"]')!.disabled).toBe(false);
  });

  it('a network failure while accepting shows an error toast and keeps the request pending', async () => {
    vi.mocked(listReceivedRequests).mockResolvedValue([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);
    vi.mocked(acceptFriendRequest).mockRejectedValue(new Error('Network error'));

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-aceptar"]')!.click();
    await flush();

    expect(document.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="friends-card-recibida"]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-aceptar"]')!.disabled).toBe(false);
  });

  it('a network failure while declining shows an error toast', async () => {
    vi.mocked(listReceivedRequests).mockResolvedValue([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);
    vi.mocked(declineFriendRequest).mockRejectedValue(new Error('Network error'));

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-rechazar"]')!.click();
    await flush();

    expect(document.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
  });

  it('a network failure while revoking shows an error toast', async () => {
    vi.mocked(listSentRequests).mockResolvedValue([
      { id: 'fr-2', toUsername: 'friend2', status: 'pending', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);
    vi.mocked(revokeFriendRequest).mockRejectedValue(new Error('Network error'));

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-revocar"]')!.click();
    await flush();

    expect(document.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
  });

  it('accepting a received request calls acceptFriendRequest and refreshes the list', async () => {
    vi.mocked(listReceivedRequests).mockResolvedValueOnce([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(acceptFriendRequest).mockResolvedValue(undefined);

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-aceptar"]')!.click();
    await flush();

    expect(acceptFriendRequest).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'fr-1');
    expect(listReceivedRequests).toHaveBeenCalledTimes(2);
    expect(root.querySelector('[data-cy="friends-card-recibida"]')).toBeNull();
  });

  it('declining a received request calls declineFriendRequest', async () => {
    vi.mocked(listReceivedRequests).mockResolvedValueOnce([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(declineFriendRequest).mockResolvedValue(undefined);

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-rechazar"]')!.click();
    await flush();

    expect(declineFriendRequest).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'fr-1');
  });

  it('lists sent requests with their status, revoking only pending ones', async () => {
    vi.mocked(listSentRequests).mockResolvedValue([
      { id: 'fr-2', toUsername: 'friend2', status: 'pending', createdAt: '2026-08-23T10:00:00.000Z' },
      { id: 'fr-3', toUsername: 'friend3', status: 'accepted', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);

    const { root } = await mountWithSession();

    const cards = root.querySelectorAll('[data-cy="friends-card-enviada"]');
    expect(cards).toHaveLength(2);
    expect(root.querySelectorAll('[data-cy="friends-btn-revocar"]')).toHaveLength(1);
  });

  it('revoking a sent request calls revokeFriendRequest', async () => {
    vi.mocked(listSentRequests).mockResolvedValueOnce([
      { id: 'fr-2', toUsername: 'friend2', status: 'pending', createdAt: '2026-08-23T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(revokeFriendRequest).mockResolvedValue(undefined);

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="friends-btn-revocar"]')!.click();
    await flush();

    expect(revokeFriendRequest).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'fr-2');
  });

  it('regresión: refresca al recibir view-friends, no solo una vez al montar sin sesión todavía', async () => {
    const el = document.createElement('friends-view') as HTMLElement & { sessionRepository: MemorySessionRepository };
    document.body.appendChild(el);
    el.sessionRepository = new MemorySessionRepository();
    await flush();
    expect(listReceivedRequests).not.toHaveBeenCalled();

    await el.sessionRepository.save({ token: 'jwt-token', email: 'me@example.com' });
    vi.mocked(listReceivedRequests).mockResolvedValue([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);
    dispatchAppEvent(APP_EVENTS.VIEW_FRIENDS);
    await flush();

    expect(listReceivedRequests).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector('[data-cy="friends-card-recibida"]')).not.toBeNull();
  });

  it('the back button dispatches nav-perfil', async () => {
    const { root } = await mountWithSession();
    const handler = vi.fn();
    window.addEventListener('nav-perfil', handler);

    root.querySelector<HTMLButtonElement>('[data-cy="friends-view-btn-volver"]')!.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('nav-perfil', handler);
  });

  it('without a session, shows empty states without calling the API and hides the send form', async () => {
    const el = document.createElement('friends-view') as HTMLElement & { sessionRepository: MemorySessionRepository };
    document.body.appendChild(el);
    el.sessionRepository = new MemorySessionRepository();
    await flush();

    expect(listReceivedRequests).not.toHaveBeenCalled();
    expect(listSentRequests).not.toHaveBeenCalled();
    expect(listFriends).not.toHaveBeenCalled();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
    expect(el.shadowRoot!.querySelector('friend-selector')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-cy="friends-empty-amigos"]')).not.toBeNull();
  });
});
