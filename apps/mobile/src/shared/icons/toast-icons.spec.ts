import { describe, it, expect } from 'vitest';
import { TOAST_SUCCESS_ICON, TOAST_ERROR_ICON } from './toast-icons.js';

describe('toast-icons', () => {
  it('TOAST_SUCCESS_ICON is a 24x24 inline SVG', () => {
    expect(TOAST_SUCCESS_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });

  it('TOAST_ERROR_ICON is a 24x24 inline SVG', () => {
    expect(TOAST_ERROR_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });

  it('are visually distinct from each other', () => {
    expect(TOAST_SUCCESS_ICON).not.toBe(TOAST_ERROR_ICON);
  });
});
