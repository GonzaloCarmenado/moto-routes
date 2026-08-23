import { describe, it, expect, vi } from 'vitest';
import { buildFriendsLink } from './profile-friends-link.js';
import { APP_EVENTS } from '../shared/app-events.js';

describe('buildFriendsLink', () => {
  it('dispatches view-friends on click', () => {
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.VIEW_FRIENDS, handler);

    const btn = buildFriendsLink(0);
    expect(btn.getAttribute('data-cy')).toBe('profile-btn-amigos');
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(APP_EVENTS.VIEW_FRIENDS, handler);
  });

  it('shows no badge without pending requests', () => {
    const btn = buildFriendsLink(0);
    expect(btn.querySelector('[data-cy="profile-amigos-badge"]')).toBeNull();
  });

  it('shows the exact count when there are pending requests (1-9)', () => {
    const btn = buildFriendsLink(3);
    expect(btn.querySelector('[data-cy="profile-amigos-badge"]')?.textContent).toBe('3');
  });

  it('shows "9+" when there are more than 9 pending requests', () => {
    const btn = buildFriendsLink(12);
    expect(btn.querySelector('[data-cy="profile-amigos-badge"]')?.textContent).toBe('9+');
  });
});
