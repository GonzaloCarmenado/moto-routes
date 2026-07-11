import { describe, it, expect } from 'vitest';
import type { IRouteRepository } from './route.repository.js';
import type { CreateRoute, CreateRoutePoint, CreateRouteStop } from './route.types.js';

/**
 * Tests de contrato para IRouteRepository.
 * Se ejecutan contra cualquier implementación que cumpla la interfaz.
 * Por ahora solo contra MemoryRouteRepository.
 */

export function createRouteSuite(name: string, factory: () => IRouteRepository): void {
  describe(name, () => {
    let repo: IRouteRepository;

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
    });

    beforeEach(() => {
      repo = factory();
    });

    it('should save a route and return it with generated id and createdAt', async () => {
      const saved = await repo.save(sampleRoute, [], []);
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
      const saved = await repo.save(sampleRoute, [samplePoint('temp', 0), samplePoint('temp', 1)], [sampleStop('temp')]);
      expect(saved.id).toBeDefined();

      const points = await repo.getPointsByRouteId(saved.id);
      expect(points).toHaveLength(2);

      const stops = await repo.getStopsByRouteId(saved.id);
      expect(stops).toHaveLength(1);
    });

    it('should return null for non-existent route', async () => {
      const result = await repo.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('should return all routes ordered by date descending', async () => {
      const r1 = await repo.save({ ...sampleRoute, duration: 100 }, [], []);
      const r2 = await repo.save({ ...sampleRoute, duration: 200 }, [], []);

      const all = await repo.getAll();
      expect(all).toHaveLength(2);
      // Más reciente primero
      expect(all[0]!.id).toBe(r2.id);
      expect(all[1]!.id).toBe(r1.id);
    });

    it('should return points only for the requested route', async () => {
      const r1 = await repo.save(sampleRoute, [samplePoint('', 0)], []);
      const r2 = await repo.save(sampleRoute, [samplePoint('', 0)], []);

      const pointsR1 = await repo.getPointsByRouteId(r1.id);
      expect(pointsR1).toHaveLength(1);
      expect(pointsR1[0]!.routeId).toBe(r1.id);

      const pointsR2 = await repo.getPointsByRouteId(r2.id);
      expect(pointsR2).toHaveLength(1);
      expect(pointsR2[0]!.routeId).toBe(r2.id);
    });

    it('should delete a route and its associated points and stops', async () => {
      const saved = await repo.save(sampleRoute, [samplePoint('', 0)], [sampleStop('')]);
      await repo.delete(saved.id);

      const found = await repo.getById(saved.id);
      expect(found).toBeNull();

      const points = await repo.getPointsByRouteId(saved.id);
      expect(points).toHaveLength(0);

      const stops = await repo.getStopsByRouteId(saved.id);
      expect(stops).toHaveLength(0);
    });

    it('should return empty arrays when no points or stops exist', async () => {
      const saved = await repo.save(sampleRoute, [], []);
      const points = await repo.getPointsByRouteId(saved.id);
      expect(points).toEqual([]);
      const stops = await repo.getStopsByRouteId(saved.id);
      expect(stops).toEqual([]);
    });

    it('should return empty getAll when no routes saved', async () => {
      const all = await repo.getAll();
      expect(all).toEqual([]);
    });
  });
}