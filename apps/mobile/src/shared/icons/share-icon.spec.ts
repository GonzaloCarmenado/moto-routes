import { describe, it, expect } from 'vitest';
import { SHARE_ICON } from './share-icon.js';

describe('share-icon', () => {
  it('SHARE_ICON is a 24x24 inline SVG, not an emoji/glyph', () => {
    expect(SHARE_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(SHARE_ICON).not.toContain('🔗');
    expect(SHARE_ICON).not.toContain('📤');
  });
});
