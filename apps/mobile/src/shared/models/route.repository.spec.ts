import { describe, it, expect } from 'vitest';
import type { IRouteRepository } from './route.repository.js';
import type { CreateRoute, CreateRoutePoint, CreateRouteStop } from './route.types.js';

/**
 * Tests de contrato para IRouteRepository.
 * Se ejecutan contra cualquier implementación que cumpla la interfaz.
 * Por ahora solo contra MemoryRouteRepository.
 */

const sampleRoute: CreateRoute = {
  duration: 900,
  totalDistance: 15.3,
  avgSpeed: 61.2,
  status: 'completed',
  visibility: 'private',
  origin: 'local',
};

const samplePoint = (routeId: string, idx: number): CreateRoutePoint => ({
  routeId,
  timestamp: 1000 + idx * 1000,
  lat: 40.4168 + idx * 0.001,
  lng: -3.7038 + idx * 0.001,
  alt: 650,
  speed: 60,
});

const sampleStop = (routeId: string): CreateRouteStop => ({
  routeId,
  startTime: 5000,
  endTime: 7000,
  lat: 40.42,
  lng: -3.7,
  type: 'auto',
  stopCategoryId: null,
});

function registerPersistenceTests(getRepo: () => IRouteRepository): void {
  it('should save a route and return it with generated id and createdAt', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    expect(saved.id).toBeDefined();
    expect(typeof saved.id).toBe('string');
    expect(saved.id.length).toBeGreaterThan(0);
    expect(saved.createdAt).toBeDefined();
    expect(typeof saved.createdAt).toBe('string');
    expect(saved.duration).toBe(900);
    expect(saved.totalDistance).toBe(15.3);
    expect(saved.avgSpeed).toBe(61.2);
    expect(saved.status).toBe('completed');
    expect(saved.visibility).toBe('private');
    expect(saved.origin).toBe('local');
  });

  it('should save a route with points and stops', async () => {
    const saved = await getRepo().save(sampleRoute, [samplePoint('temp', 0), samplePoint('temp', 1)], [sampleStop('temp')]);
    expect(saved.id).toBeDefined();

    const points = await getRepo().getPointsByRouteId(saved.id);
    expect(points).toHaveLength(2);

    const stops = await getRepo().getStopsByRouteId(saved.id);
    expect(stops).toHaveLength(1);
  });

  it('should use a pre-generated id when provided (allows linking photos captured before the route is saved)', async () => {
    const pregeneratedId = crypto.randomUUID();
    const saved = await getRepo().save({ ...sampleRoute, id: pregeneratedId }, [], []);
    expect(saved.id).toBe(pregeneratedId);

    const fetched = await getRepo().getById(pregeneratedId);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(pregeneratedId);
  });

  it('should return null for non-existent route', async () => {
    const result = await getRepo().getById('nonexistent');
    expect(result).toBeNull();
  });

  it('should update (not duplicate) an existing route when saved again with the same id, preserving createdAt', async () => {
    const routeId = crypto.randomUUID();
    const first = await getRepo().save({ ...sampleRoute, id: routeId, status: 'active', duration: 0 }, [], []);
    expect(first.status).toBe('active');

    await getRepo().save({ ...sampleRoute, id: routeId, status: 'completed', duration: 900 }, [], []);

    // Re-fetch instead of trusting save()'s return value — this must reflect what
    // actually got persisted (UPDATE), not just echo back the input we passed in.
    const refetched = await getRepo().getById(routeId);
    expect(refetched).not.toBeNull();
    expect(refetched!.status).toBe('completed');
    expect(refetched!.duration).toBe(900);
    expect(refetched!.createdAt).toBe(first.createdAt);

    const all = await getRepo().getAll();
    expect(all.filter((r) => r.id === routeId)).toHaveLength(1);
  });

  it('should accumulate points/stops across multiple save() calls for the same route id (recording flow: insert active route at start, add points at stop)', async () => {
    const routeId = crypto.randomUUID();
    await getRepo().save({ ...sampleRoute, id: routeId, status: 'active' }, [], []);
    await getRepo().save(
      { ...sampleRoute, id: routeId, status: 'completed' },
      [samplePoint(routeId, 0), samplePoint(routeId, 1)],
      [sampleStop(routeId)],
    );

    const points = await getRepo().getPointsByRouteId(routeId);
    expect(points).toHaveLength(2);
    const stops = await getRepo().getStopsByRouteId(routeId);
    expect(stops).toHaveLength(1);
  });
}

function registerPreviewPolylineTests(getRepo: () => IRouteRepository): void {
  it('should default previewPolyline to null on a freshly saved route (AC-020)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    expect(saved.previewPolyline).toBeNull();
  });

  it('should persist and retrieve previewPolyline via updatePreviewPolyline (AC-020)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    const polyline: [number, number][] = [
      [40.4168, -3.7038],
      [40.42, -3.71],
    ];

    await getRepo().updatePreviewPolyline(saved.id, polyline);

    const fetched = await getRepo().getById(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.previewPolyline).toEqual(polyline);
  });

  it('should NOT wipe previewPolyline on a subsequent save() call for the same id (regression, ADR-020/ADR-023 upsert data-loss pattern — active -> completed recording flow)', async () => {
    const routeId = crypto.randomUUID();
    await getRepo().save({ ...sampleRoute, id: routeId, status: 'active' }, [], []);

    const polyline: [number, number][] = [
      [10, 20],
      [11, 21],
      [12, 22],
    ];
    await getRepo().updatePreviewPolyline(routeId, polyline);

    // Mirrors the real recording flow: save() is called again with the same id
    // once the route completes (see ADR-020, insert-active/update-on-stop pattern).
    await getRepo().save({ ...sampleRoute, id: routeId, status: 'completed' }, [], []);

    const fetched = await getRepo().getById(routeId);
    expect(fetched).not.toBeNull();
    expect(fetched!.previewPolyline).toEqual(polyline);
  });
}

function registerNameAndNotesTests(getRepo: () => IRouteRepository): void {
  it('should persist and return the name passed in CreateRoute tal cual (AC-004)', async () => {
    const saved = await getRepo().save({ ...sampleRoute, name: 'Puerto de la Bonaigua' }, [], []);
    expect(saved.name).toBe('Puerto de la Bonaigua');

    const fetched = await getRepo().getById(saved.id);
    expect(fetched!.name).toBe('Puerto de la Bonaigua');
  });

  it('should default name to null on a freshly saved route without name (prepares AC-007 fallback)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    expect(saved.name).toBeNull();
  });

  it('should default notes to null on a freshly saved route (AC-015)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    expect(saved.notes).toBeNull();
  });

  it('should persist and retrieve notes via updateNotes (AC-015)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    await getRepo().updateNotes(saved.id, 'Buen firme, gasolinera en el km 40');

    const fetched = await getRepo().getById(saved.id);
    expect(fetched!.notes).toBe('Buen firme, gasolinera en el km 40');
  });

  it('should leave notes as null when updateNotes is called with null on a route that had notes (AC-016)', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    await getRepo().updateNotes(saved.id, 'Nota temporal');
    await getRepo().updateNotes(saved.id, null);

    const fetched = await getRepo().getById(saved.id);
    expect(fetched!.notes).toBeNull();
  });

  it('should not throw when updateNotes targets a non-existent route id (no-op, same as updatePreviewPolyline)', async () => {
    await expect(getRepo().updateNotes('nonexistent', 'texto')).resolves.not.toThrow();
  });
}

function registerQueryTests(getRepo: () => IRouteRepository): void {
  it('should return all routes ordered by date descending', async () => {
    const r1 = await getRepo().save({ ...sampleRoute, duration: 100 }, [], []);
    const r2 = await getRepo().save({ ...sampleRoute, duration: 200 }, [], []);

    const all = await getRepo().getAll();
    expect(all).toHaveLength(2);
    // Más reciente primero
    expect(all[0]!.id).toBe(r2.id);
    expect(all[1]!.id).toBe(r1.id);
  });

  it('should return points only for the requested route', async () => {
    const r1 = await getRepo().save(sampleRoute, [samplePoint('', 0)], []);
    const r2 = await getRepo().save(sampleRoute, [samplePoint('', 0)], []);

    const pointsR1 = await getRepo().getPointsByRouteId(r1.id);
    expect(pointsR1).toHaveLength(1);
    expect(pointsR1[0]!.routeId).toBe(r1.id);

    const pointsR2 = await getRepo().getPointsByRouteId(r2.id);
    expect(pointsR2).toHaveLength(1);
    expect(pointsR2[0]!.routeId).toBe(r2.id);
  });
}

function registerDeletionAndEmptyStateTests(getRepo: () => IRouteRepository): void {
  it('should delete a route and its associated points and stops', async () => {
    const saved = await getRepo().save(sampleRoute, [samplePoint('', 0)], [sampleStop('')]);
    await getRepo().delete(saved.id);

    const found = await getRepo().getById(saved.id);
    expect(found).toBeNull();

    const points = await getRepo().getPointsByRouteId(saved.id);
    expect(points).toHaveLength(0);

    const stops = await getRepo().getStopsByRouteId(saved.id);
    expect(stops).toHaveLength(0);
  });

  it('should return empty arrays when no points or stops exist', async () => {
    const saved = await getRepo().save(sampleRoute, [], []);
    const points = await getRepo().getPointsByRouteId(saved.id);
    expect(points).toEqual([]);
    const stops = await getRepo().getStopsByRouteId(saved.id);
    expect(stops).toEqual([]);
  });

  it('should return empty getAll when no routes saved', async () => {
    const all = await getRepo().getAll();
    expect(all).toEqual([]);
  });
}

export function createRouteSuite(name: string, factory: () => IRouteRepository): void {
  describe(name, () => {
    let repo: IRouteRepository;
    const getRepo = (): IRouteRepository => repo;

    beforeEach(() => {
      repo = factory();
    });

    registerPersistenceTests(getRepo);
    registerQueryTests(getRepo);
    registerDeletionAndEmptyStateTests(getRepo);
    registerPreviewPolylineTests(getRepo);
    registerNameAndNotesTests(getRepo);
  });
}
