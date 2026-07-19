import { describe, it, expect } from 'vitest';
import { toGeoJSON, computeBounds, oklchStringToRgb } from './route-map.transform.js';

function parseRgb(rgb: string): [number, number, number] {
  const match = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb);
  if (!match) throw new Error(`Not an rgb() string: ${rgb}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function expectCloseRgb(actual: string, expected: [number, number, number], tolerance = 2): void {
  const [r, g, b] = parseRgb(actual);
  const [er, eg, eb] = expected;
  expect(Math.abs(r - er)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(g - eg)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(b - eb)).toBeLessThanOrEqual(tolerance);
}

describe('toGeoJSON', () => {
  it('should convert points to a LineString with [lng, lat] order', () => {
    const points = [
      { lat: 40.4168, lng: -3.7038 },
      { lat: 41.3874, lng: 2.1686 },
    ];

    const feature = toGeoJSON(points);

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.geometry.coordinates).toEqual([
      [-3.7038, 40.4168],
      [2.1686, 41.3874],
    ]);
  });

  it('should handle an empty array without throwing', () => {
    const feature = toGeoJSON([]);

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.coordinates).toEqual([]);
  });
});

describe('computeBounds', () => {
  it('should compute the correct bounding box for multiple points', () => {
    const points = [
      { lat: 40.0, lng: -4.0 },
      { lat: 41.5, lng: 2.5 },
      { lat: 39.5, lng: -1.0 },
    ];

    const bounds = computeBounds(points);

    expect(bounds).toEqual([
      [-4.0, 39.5],
      [2.5, 41.5],
    ]);
  });

  it('should return the same point twice for a single-point route', () => {
    const points = [{ lat: 40.4168, lng: -3.7038 }];

    const bounds = computeBounds(points);

    expect(bounds).toEqual([
      [-3.7038, 40.4168],
      [-3.7038, 40.4168],
    ]);
  });

  it('should return null for an empty array', () => {
    const bounds = computeBounds([]);

    expect(bounds).toBeNull();
  });
});

describe('oklchStringToRgb', () => {
  it('should convert oklch with percent lightness to the browser-verified rgb value', () => {
    // Oráculo: valor real medido en Chrome via canvas getImageData sobre
    // el token --amber (oklch(74% 0.17 48)) en condiciones sin bloqueo.
    const rgb = oklchStringToRgb('oklch(74% 0.17 48)');
    expect(rgb).not.toBeNull();
    expectCloseRgb(rgb!, [254, 132, 61]);
  });

  it('should convert oklch with decimal lightness (browser-normalized form) to the same rgb value', () => {
    const rgb = oklchStringToRgb('oklch(0.74 0.17 48)');
    expect(rgb).not.toBeNull();
    expectCloseRgb(rgb!, [254, 132, 61]);
  });

  it('should return the same result for both percent and decimal forms', () => {
    const withPercent = oklchStringToRgb('oklch(74% 0.17 48)');
    const withDecimal = oklchStringToRgb('oklch(0.74 0.17 48)');
    expect(withPercent).toBe(withDecimal);
  });

  it('should return null for a non-oklch string', () => {
    expect(oklchStringToRgb('rgb(254, 132, 61)')).toBeNull();
    expect(oklchStringToRgb('#d4880f')).toBeNull();
    expect(oklchStringToRgb('')).toBeNull();
  });

  it('should clamp out-of-gamut channels instead of producing invalid values', () => {
    const rgb = oklchStringToRgb('oklch(0.9 0.4 200)');
    expect(rgb).not.toBeNull();
    const [r, g, b] = parseRgb(rgb!);
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});
