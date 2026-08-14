import { describe, it, expect } from 'vitest';
import { FAVORITE_ICON } from './favorite-icons.js';

describe('favorite-icons', () => {
  it('FAVORITE_ICON is a 24x24 inline SVG, not an emoji/glyph', () => {
    expect(FAVORITE_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(FAVORITE_ICON).not.toContain('⭐');
    expect(FAVORITE_ICON).not.toContain('★');
  });
});
