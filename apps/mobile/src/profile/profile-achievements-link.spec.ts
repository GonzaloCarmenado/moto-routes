import { describe, it, expect, vi } from 'vitest';
import { buildAchievementsLink } from './profile-achievements-link.js';
import { APP_EVENTS } from '../shared/app-events.js';

describe('buildAchievementsLink', () => {
  it('dispatches view-achievements on click', () => {
    const handler = vi.fn();
    window.addEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, handler);

    const btn = buildAchievementsLink();
    expect(btn.getAttribute('data-cy')).toBe('profile-btn-mis-logros');
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, handler);
  });
});
