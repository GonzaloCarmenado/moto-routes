import { describe, it, expect } from 'vitest';
import { STOP_TYPE_ICON_BY_KEY, STOP_TYPE_ICON_FALLBACK, resolveStopTypeIcon } from './stop-type-icons.js';

const CATALOG_KEYS = [
  'bar-restaurante',
  'mirador',
  'monumento',
  'gasolinera',
  'alojamiento',
  'taller-mecanico',
  'aparcamiento',
  'otro',
];

describe('stop-type-icons', () => {
  it('maps every real catalog key to a valid 24x24 inline SVG', () => {
    for (const key of CATALOG_KEYS) {
      expect(STOP_TYPE_ICON_BY_KEY[key]).toMatch(/^<svg viewBox="0 0 24 24">/);
    }
  });

  it('gives every catalog key a distinct icon', () => {
    const icons = CATALOG_KEYS.map((key) => STOP_TYPE_ICON_BY_KEY[key]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('STOP_TYPE_ICON_FALLBACK is a valid 24x24 inline SVG, distinct from every mapped key', () => {
    expect(STOP_TYPE_ICON_FALLBACK).toMatch(/^<svg viewBox="0 0 24 24">/);
    for (const key of CATALOG_KEYS) {
      expect(STOP_TYPE_ICON_FALLBACK).not.toBe(STOP_TYPE_ICON_BY_KEY[key]);
    }
  });

  it('resolveStopTypeIcon returns the mapped icon for a known key', () => {
    expect(resolveStopTypeIcon('mirador')).toBe(STOP_TYPE_ICON_BY_KEY['mirador']);
  });

  it('resolveStopTypeIcon falls back for an unknown key, never returns undefined or empty', () => {
    expect(resolveStopTypeIcon('categoria-futura-sin-icono')).toBe(STOP_TYPE_ICON_FALLBACK);
  });
});
