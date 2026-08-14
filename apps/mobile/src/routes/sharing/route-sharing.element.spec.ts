import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemorySessionRepository } from '../../shared/repositories/memory-session.repository.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import {
  fetchReceivedInvitations,
  fetchSentInvitations,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
} from '../../shared/http/route-sharing-api.service.js';
import type * as RouteSharingApiService from '../../shared/http/route-sharing-api.service.js';
import './route-sharing.element.js';

vi.mock('../../shared/http/route-sharing-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteSharingApiService>();
  return {
    ...actual,
    fetchReceivedInvitations: vi.fn().mockResolvedValue([]),
    fetchSentInvitations: vi.fn().mockResolvedValue([]),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
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

  const el = document.createElement('route-sharing') as HTMLElement & { sessionRepository: MemorySessionRepository };
  document.body.appendChild(el);
  el.sessionRepository = sessionRepository;
  await flush();

  return { el, root: el.shadowRoot!, sessionRepository };
}

describe('route-sharing', () => {
  afterEach(() => {
    document.body.querySelectorAll('route-sharing').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('shows the empty state for received invitations when there are none', async () => {
    const { root } = await mountWithSession();

    expect(root.querySelector('[data-cy="route-sharing-empty-recibidas"]')).not.toBeNull();
  });

  it('shows the empty state for sent invitations when there are none', async () => {
    const { root } = await mountWithSession();

    expect(root.querySelector('[data-cy="route-sharing-empty-enviadas"]')).not.toBeNull();
  });

  it('lists received invitations with the sender email and route name', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValue([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);

    const { root } = await mountWithSession();

    const card = root.querySelector('[data-cy="route-sharing-card-recibida"]');
    expect(card?.textContent).toContain('Ruta compartida');
    expect(card?.textContent).toContain('sender@example.com');
  });

  it('accepting a received invitation calls acceptInvitation and refreshes the list', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValueOnce([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(acceptInvitation).mockResolvedValue('cloned-route-1');

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-aceptar"]')!.click();
    await flush();

    expect(acceptInvitation).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'inv-1');
    expect(fetchReceivedInvitations).toHaveBeenCalledTimes(2);
    expect(root.querySelector('[data-cy="route-sharing-card-recibida"]')).toBeNull();
  });

  it('a network failure while accepting shows an error toast and keeps the invitation pending', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValue([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);
    vi.mocked(acceptInvitation).mockRejectedValue(new Error('Network error'));

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-aceptar"]')!.click();
    await flush();

    expect(document.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="route-sharing-card-recibida"]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-aceptar"]')!.disabled).toBe(false);
  });

  it('declining a received invitation calls declineInvitation', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValueOnce([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(declineInvitation).mockResolvedValue(undefined);

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-rechazar"]')!.click();
    await flush();

    expect(declineInvitation).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'inv-1');
  });

  it('lists sent invitations with their status and the recipient email, revoking only pending ones', async () => {
    vi.mocked(fetchSentInvitations).mockResolvedValue([
      { id: 'inv-2', routeId: 'route-2', routeName: 'Ruta enviada', routeCreatedAt: '2026-08-14T10:00:00.000Z', toEmail: 'friend@example.com', status: 'pending', createdAt: '2026-08-14T10:00:00.000Z' },
      { id: 'inv-3', routeId: 'route-3', routeName: 'Ruta ya aceptada', routeCreatedAt: '2026-08-14T10:00:00.000Z', toEmail: 'friend2@example.com', status: 'accepted', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);

    const { root } = await mountWithSession();

    const cards = root.querySelectorAll('[data-cy="route-sharing-card-enviada"]');
    expect(cards).toHaveLength(2);
    expect(root.querySelectorAll('[data-cy="route-sharing-btn-revocar"]')).toHaveLength(1);
  });

  it('revoking a sent invitation calls revokeInvitation', async () => {
    vi.mocked(fetchSentInvitations).mockResolvedValueOnce([
      { id: 'inv-2', routeId: 'route-2', routeName: 'Ruta enviada', routeCreatedAt: '2026-08-14T10:00:00.000Z', toEmail: 'friend@example.com', status: 'pending', createdAt: '2026-08-14T10:00:00.000Z' },
    ]).mockResolvedValueOnce([]);
    vi.mocked(revokeInvitation).mockResolvedValue(undefined);

    const { root } = await mountWithSession();
    root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-revocar"]')!.click();
    await flush();

    expect(revokeInvitation).toHaveBeenCalledWith(expect.any(String), 'jwt-token', 'inv-2');
  });

  it('regresión: refresca al recibir view-sharing, no solo una vez al montar sin sesión todavía', async () => {
    // El componente se monta a menudo (app.element.ts) antes de que haya
    // sesión activa (arranque de la app) — sin este refetch por evento, se
    // queda con las listas vacías para siempre aunque el usuario haga login
    // después y vuelva a abrir esta pantalla (bug real encontrado en Cypress).
    const el = document.createElement('route-sharing') as HTMLElement & { sessionRepository: MemorySessionRepository };
    document.body.appendChild(el);
    el.sessionRepository = new MemorySessionRepository();
    await flush();
    expect(fetchReceivedInvitations).not.toHaveBeenCalled();

    await el.sessionRepository.save({ token: 'jwt-token', email: 'me@example.com' });
    vi.mocked(fetchReceivedInvitations).mockResolvedValue([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);
    dispatchAppEvent(APP_EVENTS.VIEW_SHARING);
    await flush();

    expect(fetchReceivedInvitations).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector('[data-cy="route-sharing-card-recibida"]')).not.toBeNull();
  });

  it('the back button dispatches nav-rutas', async () => {
    const { root } = await mountWithSession();
    const handler = vi.fn();
    window.addEventListener('nav-rutas', handler);

    root.querySelector<HTMLButtonElement>('[data-cy="route-sharing-btn-volver"]')!.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('nav-rutas', handler);
  });

  it('without a session, shows empty received/sent without calling the API', async () => {
    const el = document.createElement('route-sharing') as HTMLElement & { sessionRepository: MemorySessionRepository };
    document.body.appendChild(el);
    el.sessionRepository = new MemorySessionRepository();
    await flush();

    expect(fetchReceivedInvitations).not.toHaveBeenCalled();
    expect(fetchSentInvitations).not.toHaveBeenCalled();
    expect(el.shadowRoot!.querySelector('[data-cy="route-sharing-empty-recibidas"]')).not.toBeNull();
  });
});
