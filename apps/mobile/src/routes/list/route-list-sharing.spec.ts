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

  it('renders a button with data-cy, not marked active without pending invitations', () => {
    const btn = buildSharingButton(false);

    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-cy')).toBe('route-list-btn-invitaciones');
    expect(btn.classList.contains('favorite-icon--active')).toBe(false);
  });

  it('is marked active when there are pending invitations', () => {
    const btn = buildSharingButton(true);
    expect(btn.classList.contains('favorite-icon--active')).toBe(true);
  });

  it('dispatches view-sharing on click', () => {
    const btn = buildSharingButton(false);
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

  it('returns false without a session, without calling the API', async () => {
    const result = await hasPendingReceivedInvitations('http://localhost:8080', null);
    expect(result).toBe(false);
    expect(fetchReceivedInvitations).not.toHaveBeenCalled();
  });

  it('returns true when there is at least one received invitation', async () => {
    vi.mocked(fetchReceivedInvitations).mockResolvedValue([
      { id: 'inv-1', routeId: 'route-1', routeName: null, routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T10:00:00.000Z' },
    ]);

    const result = await hasPendingReceivedInvitations('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(true);
  });

  it('returns false when the API call fails (best-effort, never breaks the list)', async () => {
    vi.mocked(fetchReceivedInvitations).mockRejectedValue(new Error('Network error'));

    const result = await hasPendingReceivedInvitations('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(false);
  });
});
