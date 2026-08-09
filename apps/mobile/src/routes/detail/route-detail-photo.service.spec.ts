import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addPhotoToRoute, syncPhotoRemoteState } from './route-detail-photo.service.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { CreatePhoto } from '../../shared/models/photo.types.js';
import type { PhotoWithUrl } from './route-detail.types.js';

function createMockRepo(): IPhotoRepository {
  return {
    add: vi.fn().mockImplementation((photo: CreatePhoto) =>
      Promise.resolve({ ...photo, id: crypto.randomUUID(), createdAt: new Date().toISOString() }),
    ),
    getByRouteId: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    countByRouteId: vi.fn().mockResolvedValue(0),
    markPhotoSynced: vi.fn().mockResolvedValue(undefined),
  };
}

describe('addPhotoToRoute', () => {
  let photoRepo: IPhotoRepository;
  const routeId = 'route-abc';
  const mockFile = new File(['fake-image-content'], 'test.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    photoRepo = createMockRepo();
  });

  it('returns null and does not persist anything when file is null (user cancelled)', async () => {
    const result = await addPhotoToRoute(null, routeId, photoRepo);
    expect(result).toBeNull();
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('throws for an unsupported file format and does not persist', async () => {
    const gifFile = new File([''], 'test.gif', { type: 'image/gif' });
    await expect(addPhotoToRoute(gifFile, routeId, photoRepo)).rejects.toThrow('Formato no soportado');
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('persists the photo associated to the given routeId', async () => {
    const result = await addPhotoToRoute(mockFile, routeId, photoRepo);
    expect(result).not.toBeNull();
    expect(photoRepo.add).toHaveBeenCalledTimes(1);
    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.routeId).toBe(routeId);
  });

  it('falls back to the route centroid when the photo has no EXIF GPS (AC-013)', async () => {
    // Sin EXIF (mockFile no tiene metadatos GPS reales) y sin fallbackPoint individual,
    // debe heredar el centroide (promedio) de los puntos de la ruta.
    const routePoints = [
      { lat: 40.0, lng: -3.0 },
      { lat: 42.0, lng: -5.0 },
    ];
    const result = await addPhotoToRoute(mockFile, routeId, photoRepo, routePoints);
    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.latitude).toBe(41.0);
    expect(addedPhoto.longitude).toBe(-4.0);
    expect(result?.photo.latitude).toBe(41.0);
  });

  it('persists null coordinates when there is no GPS and no route points to fall back to', async () => {
    const result = await addPhotoToRoute(mockFile, routeId, photoRepo, []);
    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.latitude).toBeNull();
    expect(addedPhoto.longitude).toBeNull();
    expect(result?.photo.latitude).toBeNull();
  });

  it('returns an objectUrl usable as an <img> src', async () => {
    const result = await addPhotoToRoute(mockFile, routeId, photoRepo);
    expect(result?.objectUrl).toBeTruthy();
    expect(typeof result?.objectUrl).toBe('string');
  });
});

describe('syncPhotoRemoteState', () => {
  function makePhotoWithUrl(overrides?: Partial<PhotoWithUrl>): PhotoWithUrl {
    return {
      id: 'photo-1', routeId: 'route-1', filePath: 'a.jpg', latitude: null, longitude: null,
      capturedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z',
      remotePhotoId: null, objectUrl: 'blob:x',
      ...overrides,
    };
  }

  it('refleja en la lista el remotePhotoId que el repositorio tiene para esa foto', async () => {
    const photos = [makePhotoWithUrl()];
    const repo = {
      getById: vi.fn().mockResolvedValue({ ...makePhotoWithUrl(), remotePhotoId: 'remote-photo-1' }),
    } as unknown as IPhotoRepository;

    const result = await syncPhotoRemoteState(photos, repo, 'photo-1');

    expect(result[0]?.remotePhotoId).toBe('remote-photo-1');
    expect(result[0]?.objectUrl).toBe('blob:x'); // no toca campos que no vienen del repositorio
  });

  it('deja la lista intacta si la foto ya no existe en el repositorio (borrada mientras tanto)', async () => {
    const photos = [makePhotoWithUrl()];
    const repo = { getById: vi.fn().mockResolvedValue(null) } as unknown as IPhotoRepository;

    const result = await syncPhotoRemoteState(photos, repo, 'photo-1');

    expect(result).toEqual(photos);
  });

  it('no toca otras fotos de la lista', async () => {
    const photos = [makePhotoWithUrl({ id: 'photo-1' }), makePhotoWithUrl({ id: 'photo-2' })];
    const repo = {
      getById: vi.fn().mockResolvedValue({ ...makePhotoWithUrl(), remotePhotoId: 'remote-photo-1' }),
    } as unknown as IPhotoRepository;

    const result = await syncPhotoRemoteState(photos, repo, 'photo-1');

    expect(result.find((p) => p.id === 'photo-2')?.remotePhotoId).toBeNull();
  });
});
