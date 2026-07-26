import { describe, it, expect, vi } from 'vitest';
import { ensurePreviewPolyline } from './route-list-polyline.service.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route, RoutePoint } from '../shared/models/route.types.js';

function buildRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'r1',
    createdAt: new Date().toISOString(),
    duration: 100,
    totalDistance: 10,
    avgSpeed: 30,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    ...overrides,
  };
}

function buildPoint(lat: number, lng: number): RoutePoint {
  return { id: crypto.randomUUID(), routeId: 'r1', timestamp: Date.now(), lat, lng, alt: 0, speed: 0 };
}

function buildMockRepo(points: RoutePoint[]): IRouteRepository {
  return {
    save: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    getPointsByRouteId: vi.fn().mockResolvedValue(points),
    getStopsByRouteId: vi.fn(),
    delete: vi.fn(),
    updatePreviewPolyline: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ensurePreviewPolyline (AC-031, AC-024)', () => {
  it('computes and persists the polyline exactly once when the route has no previewPolyline but has points (AC-031)', async () => {
    const points = [buildPoint(10, 20), buildPoint(11, 21)];
    const repo = buildMockRepo(points);
    const route = buildRoute();

    const result = await ensurePreviewPolyline(repo, route);

    expect(repo.updatePreviewPolyline).toHaveBeenCalledOnce();
    expect(result).toEqual([
      [10, 20],
      [11, 21],
    ]);
  });

  it('does not recompute on a second load when the route already has a previewPolyline (AC-031)', async () => {
    const repo = buildMockRepo([buildPoint(10, 20), buildPoint(11, 21)]);
    const existingPolyline: [number, number][] = [
      [1, 2],
      [3, 4],
    ];
    const route = buildRoute({ previewPolyline: existingPolyline });

    const result = await ensurePreviewPolyline(repo, route);

    expect(repo.getPointsByRouteId).not.toHaveBeenCalled();
    expect(repo.updatePreviewPolyline).not.toHaveBeenCalled();
    expect(result).toEqual(existingPolyline);
  });

  it('returns null without throwing and without persisting when there are no route_points (AC-024)', async () => {
    const repo = buildMockRepo([]);
    const route = buildRoute();

    await expect(ensurePreviewPolyline(repo, route)).resolves.toBeNull();
    expect(repo.updatePreviewPolyline).not.toHaveBeenCalled();
  });
});
