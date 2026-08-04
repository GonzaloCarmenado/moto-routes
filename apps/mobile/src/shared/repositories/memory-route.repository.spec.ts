import { describe, it, expect } from 'vitest';
import { MemoryRouteRepository } from './memory-route.repository.js';
import { createRouteSuite } from '../models/route.repository.spec.js';
import type { Route, RoutePoint, RouteStop } from '../models/route.types.js';

createRouteSuite('MemoryRouteRepository', () => new MemoryRouteRepository());

function buildRoute(id: string, createdAt: string): Route {
  return {
    id,
    createdAt,
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

describe('MemoryRouteRepository.seed()', () => {
  it('seeds 2 complete routes with their points/stops, retrievable via getAll/getPointsByRouteId/getStopsByRouteId', async () => {
    const repo = new MemoryRouteRepository();
    const routeA = buildRoute('route-a', '2026-01-01T00:00:00.000Z');
    const routeB = buildRoute('route-b', '2026-01-02T00:00:00.000Z');
    const pointsA: RoutePoint[] = [{ id: 'p1', routeId: 'route-a', timestamp: 1, lat: 1, lng: 2, alt: 0, speed: 0 }];
    const stopsA: RouteStop[] = [{ id: 's1', routeId: 'route-a', startTime: 1, endTime: 2, lat: 1, lng: 2, type: 'auto', stopCategoryId: null }];
    const pointsB: RoutePoint[] = [{ id: 'p2', routeId: 'route-b', timestamp: 5, lat: 3, lng: 4, alt: 0, speed: 0 }];
    const stopsB: RouteStop[] = [{ id: 's2', routeId: 'route-b', startTime: 5, endTime: 6, lat: 3, lng: 4, type: 'manual', stopCategoryId: 2 }];

    repo.seed(
      [routeA, routeB],
      { 'route-a': pointsA, 'route-b': pointsB },
      { 'route-a': stopsA, 'route-b': stopsB },
    );

    const all = await repo.getAll();
    expect(all).toHaveLength(2);
    expect(await repo.getPointsByRouteId('route-a')).toEqual(pointsA);
    expect(await repo.getPointsByRouteId('route-b')).toEqual(pointsB);
    expect(await repo.getStopsByRouteId('route-a')).toEqual(stopsA);
    expect(await repo.getStopsByRouteId('route-b')).toEqual(stopsB);
  });

  it('returns [] for points/stops when those parameters are omitted, without throwing', async () => {
    const repo = new MemoryRouteRepository();
    const routeA = buildRoute('route-a', '2026-01-01T00:00:00.000Z');

    expect(() => { repo.seed([routeA]); }).not.toThrow();

    expect(await repo.getPointsByRouteId('route-a')).toEqual([]);
    expect(await repo.getStopsByRouteId('route-a')).toEqual([]);
  });

  it('keeps getAll() returning [] when seeded with routes: []', async () => {
    const repo = new MemoryRouteRepository();
    expect(() => { repo.seed([]); }).not.toThrow();
    expect(await repo.getAll()).toEqual([]);
  });

  it('getAll() after seed() respects the same order (createdAt desc, ties by insertion) used by save()', async () => {
    const repo = new MemoryRouteRepository();
    const older = buildRoute('older', '2026-01-01T00:00:00.000Z');
    const newer = buildRoute('newer', '2026-01-02T00:00:00.000Z');
    const sameTimeFirst = buildRoute('same-first', '2026-01-03T00:00:00.000Z');
    const sameTimeSecond = buildRoute('same-second', '2026-01-03T00:00:00.000Z');

    repo.seed([older, newer, sameTimeFirst, sameTimeSecond]);

    const all = await repo.getAll();
    expect(all.map((r) => r.id)).toEqual(['same-second', 'same-first', 'newer', 'older']);
  });
});