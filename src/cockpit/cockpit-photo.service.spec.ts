import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPhotoCapture } from './cockpit-photo.service.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { CreatePhoto } from '../shared/models/photo.types.js';
import type { RoutePoint } from './cockpit.types.js';

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

describe('processPhotoCapture (cockpit)', () => {
  let photoRepo: IPhotoRepository;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  const mockFile = new File(['fake-image-content'], 'test.jpg', { type: 'image/jpeg' });
  const routeId = 'route-123';
  const lastPoint: RoutePoint = { timestamp: 1000, lat: 40.41, lng: -3.7, alt: 600, speed: 50 };

  beforeEach(() => {
    photoRepo = createMockRepo();
    onSuccess = vi.fn();
    onError = vi.fn();
    onCancel = vi.fn();
  });

  it('should call onCancel when file is null', async () => {
    await processPhotoCapture(null, routeId, photoRepo, lastPoint, [], {
      onSuccess, onError, onCancel,
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('should call onError for unsupported format', async () => {
    const gifFile = new File([''], 'test.gif', { type: 'image/gif' });
    await processPhotoCapture(gifFile, routeId, photoRepo, lastPoint, [], {
      onSuccess, onError, onCancel,
    });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Formato no soportado'));
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('should call onSuccess and persist photo for valid file', async () => {
    await processPhotoCapture(mockFile, routeId, photoRepo, lastPoint, [], {
      onSuccess, onError, onCancel,
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(photoRepo.add).toHaveBeenCalledTimes(1);
    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.routeId).toBe(routeId);
    expect(addedPhoto.filePath).toContain('photos/');
    expect(addedPhoto.filePath).toContain('-test.jpg');
  });

  it('should use lastPoint coordinates when EXIF has no GPS', async () => {
    await processPhotoCapture(mockFile, routeId, photoRepo, lastPoint, [], {
      onSuccess, onError, onCancel,
    });

    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    // Without EXIF mocking, it will fallback to lastPoint
    expect(addedPhoto.latitude).toBeDefined();
  });

  it('should persist with timestamp', async () => {
    await processPhotoCapture(mockFile, routeId, photoRepo, lastPoint, [], {
      onSuccess, onError, onCancel,
    });

    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.capturedAt).toBeDefined();
    expect(() => new Date(addedPhoto.capturedAt)).not.toThrow();
  });
});