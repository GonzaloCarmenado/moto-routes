import { describe, it, expect } from 'vitest';
import { toGeoJSON, computeBounds } from './route-map.transform.js';

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
