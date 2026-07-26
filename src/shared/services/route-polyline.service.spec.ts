import { describe, it, expect } from 'vitest';
import { simplifyPolyline } from './route-polyline.service.js';

function buildPoints(count: number): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, i) => ({ lat: i, lng: i * 2 }));
}

describe('simplifyPolyline (AC-019, AC-030)', () => {
  it('reduces 500 input points to at most ~40 points (and at least 20)', () => {
    const points = buildPoints(500);
    const result = simplifyPolyline(points);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.length).toBeGreaterThanOrEqual(20);
  });

  it('preserves the exact first and last point of the input', () => {
    const points = buildPoints(500);
    const result = simplifyPolyline(points);
    expect(result[0]).toEqual([points[0]!.lat, points[0]!.lng]);
    expect(result[result.length - 1]).toEqual([
      points[points.length - 1]!.lat,
      points[points.length - 1]!.lng,
    ]);
  });

  it('returns all points unchanged when fewer than 20 are given', () => {
    const points = buildPoints(10);
    const result = simplifyPolyline(points);
    expect(result).toHaveLength(10);
    expect(result).toEqual(points.map((p) => [p.lat, p.lng]));
  });

  it('returns [] without throwing when given 0 points', () => {
    expect(() => simplifyPolyline([])).not.toThrow();
    expect(simplifyPolyline([])).toEqual([]);
  });
});
