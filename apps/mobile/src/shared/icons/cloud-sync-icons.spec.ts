import { describe, it, expect } from 'vitest';
import { DEVICE_ICON, CLOUD_UPLOAD_ICON, CLOUD_CHECK_ICON, CLOUD_ONLY_ICON } from './cloud-sync-icons.js';

describe('cloud-sync-icons', () => {
  it('DEVICE_ICON is a 24x24 inline SVG, not the emoji it replaces', () => {
    expect(DEVICE_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(DEVICE_ICON).not.toContain('📱');
  });

  it('CLOUD_UPLOAD_ICON is a 24x24 inline SVG, not the emoji it replaces', () => {
    expect(CLOUD_UPLOAD_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(CLOUD_UPLOAD_ICON).not.toContain('☁');
  });

  it('CLOUD_CHECK_ICON is a 24x24 inline SVG, not the emoji it replaces', () => {
    expect(CLOUD_CHECK_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(CLOUD_CHECK_ICON).not.toContain('☁');
  });

  it('CLOUD_ONLY_ICON is a 24x24 inline SVG, not the emoji it replaces', () => {
    expect(CLOUD_ONLY_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
    expect(CLOUD_ONLY_ICON).not.toContain('☁');
  });

  it('every icon is a distinct SVG (no accidental duplicate paths between states)', () => {
    const icons = [DEVICE_ICON, CLOUD_UPLOAD_ICON, CLOUD_CHECK_ICON, CLOUD_ONLY_ICON];
    expect(new Set(icons).size).toBe(icons.length);
  });
});
