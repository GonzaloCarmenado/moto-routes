import { describe, it, expect } from 'vitest';
import { FRIENDS_ICON } from './friends-icon.js';

describe('friends-icon', () => {
  it('FRIENDS_ICON is a 24x24 inline SVG, not an emoji/glyph', () => {
    expect(FRIENDS_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(FRIENDS_ICON).not.toContain('👥');
    expect(FRIENDS_ICON).not.toContain('🧑');
  });
});
