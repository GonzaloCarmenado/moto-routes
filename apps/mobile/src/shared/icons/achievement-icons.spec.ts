import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_PLACEHOLDER_ICON } from './achievement-icons.js';

describe('achievement-icons', () => {
  it('ACHIEVEMENT_PLACEHOLDER_ICON is a 24x24 inline SVG', () => {
    expect(ACHIEVEMENT_PLACEHOLDER_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });
});
