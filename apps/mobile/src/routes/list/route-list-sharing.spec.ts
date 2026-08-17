import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildSharingButton, hasPendingReceivedInvitations } from './route-list-sharing.js';
import { fetchReceivedInvitations } from '../../shared/http/route-sharing-api.service.js';
import { APP_EVENTS } from '../../shared/app-events.js';
import type * as RouteSharingApiService from '../../shared/http/route-sharing-api.service.js';

vi.mock('../../shared/http/route-sharing-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteSharingApiService>();
  return { ...actual, fetchReceivedInvitations: vi.fn() };
});

describe('buildSharingButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function badge(btn: HTMLButtonElement): Element | null {
    return btn.querySelector('[data-cy="route-list-invitaciones-badge"]');
  }

  it('renders a button with data-cy, not marked active without pending invitations, no badge', () => {
    const btn = buildSharingButton(0);

    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-cy')).toBe('route-list-btn-invitaciones');
    expect(btn.classList.contains('favorite-icon--active')).toBe(false);
    expect(badge(btn)).toBeNull();
  });

  it('is marked active and shows the exact count when there are pending invitations (1-9)', () => {
    const btn = buildSharingButton(3);
    expect(btn.classList.contains('favorite-icon--active')).toBe(true);
    expect(badge(btn)?.textContent).toBe('3');
  });

  it('shows "9+" when there are more than 9 pending invitations', () => {
    const btn = buildSharingButton(12);
    expect(badge(btn)?.textContent).toBe('9+');
  });

  it('shows exactly "9" at the boundary, not "9+"', () => {
    const btn = buildSharingButton(9);
    expect(badge(btn)?.textContent).toBe('9');
  });

  it('dispatches view-sharing on click', () => {
    const btn = buildSharingButton(0);
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.VIEW_SHARING, handler);

    btn.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener(APP_EVENTS.VIEW_SHARING, handler);
  });
});

describe('hasPendingReceivedInvitations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 without a session, without calling the API', async () => {
    const result = await hasPendingReceivedInvitations('http://localhost:8080', null);
    expect(result).toBe(0);
    expect(fetchReceivedInvitations).not.toHaveBeenCalled();
  });

  it('returns the real count of received invitations', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValue([
      { id: 'inv-1', routeId: 'route-1', routeName: null, routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
      { id: 'inv-2', routeId: 'route-2', routeName: null, routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'other@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
      { id: 'inv-3', routeId: 'route-3', routeName: null, routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'third@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);

    const result = await hasPendingReceivedInvitations('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(3);
  });

  it('returns 0 when the API call fails (best-effort, never breaks the list)', async () => {
    vi.mocked(fetchReceivedInvitations).mockRejectedValue(new Error('Network error'));

    const result = await hasPendingReceivedInvitations('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(0);
  });
});
