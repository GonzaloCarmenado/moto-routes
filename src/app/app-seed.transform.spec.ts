import { describe, it, expect } from 'vitest';
import { parseCypressSeed } from './app-seed.transform.js';
import type { Route, RoutePoint, RouteStop } from '../shared/models/route.types.js';

function buildRoute(id: string): Route {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    duration: 100,
    totalDistance: 5,
    avgSpeed: 20,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
  };
}

describe('parseCypressSeed', () => {
  it('returns the parsed object when the JSON is valid with routes + points + stops', () => {
    const routeA = buildRoute('route-a');
    const routeB = buildRoute('route-b');
    const points: Record<string, RoutePoint[]> = {
      'route-a': [{ id: 'p1', routeId: 'route-a', timestamp: 1, lat: 1, lng: 2, alt: 0, speed: 0 }],
    };
    const stops: Record<string, RouteStop[]> = {
      'route-a': [{ id: 's1', routeId: 'route-a', startTime: 1, endTime: 2, lat: 1, lng: 2, type: 'auto' }],
    };
    const raw = JSON.stringify({ routes: [routeA, routeB], points, stops });

    const result = parseCypressSeed(raw);

    expect(result).toEqual({ routes: [routeA, routeB], points, stops });
  });

  it('returns null when the key is absent (raw === null)', () => {
    expect(parseCypressSeed(null)).toBeNull();
  });

  it('returns null without throwing when the JSON is corrupted', () => {
    expect(() => parseCypressSeed('{not json')).not.toThrow();
    expect(parseCypressSeed('{not json')).toBeNull();
  });

  it('returns null when the JSON is valid but has no "routes" key', () => {
    expect(parseCypressSeed(JSON.stringify({ points: {} }))).toBeNull();
  });

  it('returns null when "routes" is present but is not an array', () => {
    expect(parseCypressSeed(JSON.stringify({ routes: 'not-an-array' }))).toBeNull();
  });

  it('returns { routes: [], points: undefined, stops: undefined } when routes is an empty array', () => {
    const result = parseCypressSeed(JSON.stringify({ routes: [] }));
    expect(result).toEqual({ routes: [], points: undefined, stops: undefined });
  });

  it('leaves points/stops undefined without throwing when only routes is present', () => {
    const routeA = buildRoute('route-a');
    const result = parseCypressSeed(JSON.stringify({ routes: [routeA] }));
    expect(result).toEqual({ routes: [routeA], points: undefined, stops: undefined });
  });
});
