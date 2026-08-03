import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sin mockear, el `import('exifr')` real de extractPhotoLocation() intenta parsear
// los File de prueba (que no son JPEGs válidos) y falla en silencio, cayendo al
// fallback — lo que dejaba el camino "con GPS en EXIF" sin verificar a través del
// pipeline completo de persistencia (solo se testeaba la función pura en
// photo-geolocation.service.spec.ts, no que persistCapturedPhoto la usara de verdad).
const mockParse = vi.fn();
vi.mock('exifr', () => ({ parse: mockParse }));

import { persistCapturedPhoto } from './photo-persist.service.js';
import type { IPhotoRepository } from '../models/photo.repository.js';
import type { CreatePhoto } from '../models/photo.types.js';

function createMockRepo(): IPhotoRepository {
  return {
    add: vi.fn().mockImplementation((photo: CreatePhoto) =>
      Promise.resolve({ ...photo, id: crypto.randomUUID(), createdAt: new Date().toISOString() }),
    ),
    getByRouteId: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    countByRouteId: vi.fn().mockResolvedValue(0),
  };
}

describe('persistCapturedPhoto', () => {
  let photoRepo: IPhotoRepository;
  const routeId = 'route-1';
  const mockFile = new File(['img'], 'test.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    photoRepo = createMockRepo();
    mockParse.mockReset().mockResolvedValue(undefined);
  });

  it('persists the EXIF GPS coordinates (not the fallback) when the image has them (AC-005, AC-006)', async () => {
    mockParse.mockResolvedValue({ latitude: 40.416775, longitude: -3.70379 });

    const photo = await persistCapturedPhoto({
      file: mockFile, routeId, photoRepo,
      fallbackPoint: { lat: 0, lng: 0 },
      routePoints: [{ lat: 10, lng: 10 }],
    });

    expect(photo.latitude).toBe(40.416775);
    expect(photo.longitude).toBe(-3.70379);
  });

  it('throws on an unsupported format and does not persist', async () => {
    const gif = new File([''], 'x.gif', { type: 'image/gif' });
    await expect(persistCapturedPhoto({ file: gif, routeId, photoRepo, routePoints: [] }))
      .rejects.toThrow('Formato no soportado');
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('persists the photo with the given routeId and a valid capturedAt', async () => {
    const photo = await persistCapturedPhoto({ file: mockFile, routeId, photoRepo, routePoints: [] });
    expect(photoRepo.add).toHaveBeenCalledTimes(1);
    expect(photo.routeId).toBe(routeId);
    expect(() => new Date(photo.capturedAt)).not.toThrow();
    expect(photo.filePath).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('prefers the explicit fallbackPoint over the route centroid when EXIF has no GPS', async () => {
    const photo = await persistCapturedPhoto({
      file: mockFile, routeId, photoRepo,
      fallbackPoint: { lat: 40.41, lng: -3.7 },
      routePoints: [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }],
    });
    expect(photo.latitude).toBe(40.41);
    expect(photo.longitude).toBe(-3.7);
  });

  it('falls back to the route centroid when there is no EXIF GPS nor fallbackPoint', async () => {
    const photo = await persistCapturedPhoto({
      file: mockFile, routeId, photoRepo,
      routePoints: [{ lat: 40, lng: -3 }, { lat: 42, lng: -5 }],
    });
    expect(photo.latitude).toBe(41);
    expect(photo.longitude).toBe(-4);
  });

  it('persists null coordinates when there is no GPS and no points to fall back to', async () => {
    const photo = await persistCapturedPhoto({ file: mockFile, routeId, photoRepo, routePoints: [] });
    expect(photo.latitude).toBeNull();
    expect(photo.longitude).toBeNull();
  });

  it('propagates a repository failure and surfaces its message', async () => {
    const failing: IPhotoRepository = {
      ...photoRepo,
      add: vi.fn().mockRejectedValue(new Error('database is locked')),
    };
    await expect(persistCapturedPhoto({ file: mockFile, routeId, photoRepo: failing, routePoints: [] }))
      .rejects.toThrow('database is locked');
  });
});
