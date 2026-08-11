import { describe, it, expect } from 'vitest';
import { ROUTES_TAB_ICON, PROFILE_TAB_ICON } from './nav-icons.js';

describe('nav-icons', () => {
  it('ROUTES_TAB_ICON is a 24x24 inline SVG', () => {
    expect(ROUTES_TAB_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });

  it('PROFILE_TAB_ICON is a 24x24 inline SVG', () => {
    expect(PROFILE_TAB_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });

  it('are visually distinct from each other', () => {
    expect(ROUTES_TAB_ICON).not.toBe(PROFILE_TAB_ICON);
  });
});
