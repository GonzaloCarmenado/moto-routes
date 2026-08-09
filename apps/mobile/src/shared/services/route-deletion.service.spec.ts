import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteRouteAndPhotos } from './route-deletion.service.js';
import { MemoryRouteRepository } from '../repositories/memory-route.repository.js';
import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo, CreatePhoto } from '../models/photo.types.js';

function createMockPhotoRepo(initial: Photo[] = []): IPhotoRepository {
  let photos = [...initial];
  return {
    add: vi.fn().mockImplementation((photo: CreatePhoto) => {
      const created: Photo = { ...photo, id: crypto.randomUUID(), createdAt: new Date().toISOString(), remotePhotoId: null };
      photos.push(created);
      return Promise.resolve(created);
    }),
    getByRouteId: vi.fn().mockImplementation((routeId: string) =>
      Promise.resolve(photos.filter((p) => p.routeId === routeId))),
    getById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(photos.find((p) => p.id === id) ?? null)),
    delete: vi.fn().mockImplementation((id: string) => {
      photos = photos.filter((p) => p.id !== id);
      return Promise.resolve();
    }),
    countByRouteId: vi.fn().mockResolvedValue(0),
    markPhotoSynced: vi.fn().mockResolvedValue(undefined),
  };
}

describe('deleteRouteAndPhotos', () => {
  let routeRepo: MemoryRouteRepository;

  beforeEach(() => {
    routeRepo = new MemoryRouteRepository();
  });

  it('deletes the route itself', async () => {
    const route = await routeRepo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 30, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photoRepo = createMockPhotoRepo();

    await deleteRouteAndPhotos(routeRepo, photoRepo, route.id);

    expect(await routeRepo.getById(route.id)).toBeNull();
  });

  it('deletes every photo belonging to the route (row + best-effort file), not just the route row', async () => {
    const route = await routeRepo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 30, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photos: Photo[] = [
      { id: 'p1', routeId: route.id, filePath: 'a.jpg', latitude: null, longitude: null, capturedAt: 'x', createdAt: 'x', remotePhotoId: null },
      { id: 'p2', routeId: route.id, filePath: 'b.jpg', latitude: null, longitude: null, capturedAt: 'x', createdAt: 'x', remotePhotoId: null },
    ];
    const photoRepo = createMockPhotoRepo(photos);

    await deleteRouteAndPhotos(routeRepo, photoRepo, route.id);

    expect(photoRepo.delete).toHaveBeenCalledTimes(2);
    expect(photoRepo.delete).toHaveBeenCalledWith('p1');
    expect(photoRepo.delete).toHaveBeenCalledWith('p2');
    expect(await photoRepo.getByRouteId(route.id)).toEqual([]);
  });

  it('does not touch photos belonging to a different route', async () => {
    const routeA = await routeRepo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 30, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const routeB = await routeRepo.save(
      { duration: 50, totalDistance: 2, avgSpeed: 20, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photos: Photo[] = [
      { id: 'pa', routeId: routeA.id, filePath: 'a.jpg', latitude: null, longitude: null, capturedAt: 'x', createdAt: 'x', remotePhotoId: null },
      { id: 'pb', routeId: routeB.id, filePath: 'b.jpg', latitude: null, longitude: null, capturedAt: 'x', createdAt: 'x', remotePhotoId: null },
    ];
    const photoRepo = createMockPhotoRepo(photos);

    await deleteRouteAndPhotos(routeRepo, photoRepo, routeA.id);

    expect(await photoRepo.getByRouteId(routeB.id)).toHaveLength(1);
  });

  it('does nothing when the route has no photos', async () => {
    const route = await routeRepo.save(
      { duration: 100, totalDistance: 5, avgSpeed: 30, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const photoRepo = createMockPhotoRepo();

    await expect(deleteRouteAndPhotos(routeRepo, photoRepo, route.id)).resolves.toBeUndefined();
    expect(photoRepo.delete).not.toHaveBeenCalled();
  });
});
