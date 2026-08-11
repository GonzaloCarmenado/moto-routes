import { describe, it, expect } from 'vitest';
import { TRASH_ICON, CLOSE_ICON } from './action-icons.js';

describe('action-icons', () => {
  it('TRASH_ICON is a 24x24 inline SVG, not the emoji it replaces', () => {
    expect(TRASH_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(TRASH_ICON).not.toContain('🗑');
  });

  it('CLOSE_ICON is a 24x24 inline SVG, not the glyph it replaces', () => {
    expect(CLOSE_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(CLOSE_ICON).not.toContain('✕');
  });
});
