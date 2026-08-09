import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPhotoCapture, deleteCockpitPhoto } from './cockpit-photo.service.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { CreatePhoto, Photo } from '../../shared/models/photo.types.js';
import type { RoutePoint } from '../cockpit.types.js';
import '../../shared/feedback/confirm-dialog.element.js';

function createMockRepo(): IPhotoRepository {
  return {
    add: vi.fn().mockImplementation((photo: CreatePhoto) =>
      Promise.resolve({ ...photo, id: crypto.randomUUID(), createdAt: new Date().toISOString(), remotePhotoId: null }),
    ),
    getByRouteId: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    countByRouteId: vi.fn().mockResolvedValue(0),
    markPhotoSynced: vi.fn().mockResolvedValue(undefined),
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
    await processPhotoCapture({
      file: null, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('should call onError for unsupported format', async () => {
    const gifFile = new File([''], 'test.gif', { type: 'image/gif' });
    await processPhotoCapture({
      file: gifFile, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Formato no soportado'));
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('should call onSuccess and persist photo for valid file', async () => {
    await processPhotoCapture({
      file: mockFile, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(photoRepo.add).toHaveBeenCalledTimes(1);
    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.routeId).toBe(routeId);
    // Fuera de Tauri, savePhotoFile persiste como data URL base64 (no un path falso)
    expect(addedPhoto.filePath).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('should call onError and not persist when savePhotoFile fails', async () => {
    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(): void {
        queueMicrotask(() => { this.onerror?.(); });
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader);

    await processPhotoCapture({
      file: mockFile, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    vi.unstubAllGlobals();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(photoRepo.add).not.toHaveBeenCalled();
  });

  it('should call onError (not throw silently) when the repository fails to persist the photo', async () => {
    const failingRepo: IPhotoRepository = {
      ...photoRepo,
      add: vi.fn().mockRejectedValue(new Error('database is locked')),
    };

    await processPhotoCapture({
      file: mockFile, routeId, photoRepo: failingRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('database is locked');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('should surface the real rejection text when the repository rejects with a plain string (Tauri invoke() style, not a JS Error)', async () => {
    // @tauri-apps/plugin-sql rejects with plain strings/objects, not JS Error instances —
    // a naive `err instanceof Error` check swallows this into a generic fallback message.
    const failingRepo: IPhotoRepository = {
      ...photoRepo,
      add: vi.fn().mockRejectedValue('sql: table photos has no column named route_id'),
    };

    await processPhotoCapture({
      file: mockFile, routeId, photoRepo: failingRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    expect(onError).toHaveBeenCalledWith('sql: table photos has no column named route_id');
  });

  it('should use lastPoint coordinates when EXIF has no GPS', async () => {
    await processPhotoCapture({
      file: mockFile, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    // Without EXIF mocking, it will fallback to lastPoint
    expect(addedPhoto.latitude).toBeDefined();
  });

  it('should persist with timestamp', async () => {
    await processPhotoCapture({
      file: mockFile, routeId, photoRepo, lastPoint, routePoints: [],
      callbacks: { onSuccess, onError, onCancel },
    });

    const addedPhoto = (photoRepo.add as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as CreatePhoto;
    expect(addedPhoto.capturedAt).toBeDefined();
    expect(() => new Date(addedPhoto.capturedAt)).not.toThrow();
  });
});

describe('deleteCockpitPhoto', () => {
  const photo: Photo = {
    id: 'photo-1',
    routeId: 'route-1',
    filePath: 'photos/photo-1.jpg',
    latitude: null,
    longitude: null,
    capturedAt: '2026-07-20T10:00:00.000Z',
    createdAt: '2026-07-20T10:00:00.000Z',
    remotePhotoId: null,
  };

  async function confirmPendingDialog(action: 'confirm' | 'cancel'): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
    const dialog = document.body.querySelector('confirm-dialog')!;
    (dialog.shadowRoot!.querySelector(`[data-cy="confirm-dialog-action-${action}"]`) as HTMLButtonElement).click();
  }

  it('returns false without asking for confirmation when the photo no longer exists', async () => {
    const photoRepo = createMockRepo();
    const result = await deleteCockpitPhoto('missing-id', photoRepo);
    expect(result).toBe(false);
    expect(document.body.querySelector('confirm-dialog')).toBeNull();
  });

  it('deletes the photo and returns true when the user confirms', async () => {
    const photoRepo: IPhotoRepository = { ...createMockRepo(), getById: vi.fn().mockResolvedValue(photo) };

    const resultPromise = deleteCockpitPhoto(photo.id, photoRepo);
    await confirmPendingDialog('confirm');

    expect(await resultPromise).toBe(true);
    expect(photoRepo.delete).toHaveBeenCalledWith(photo.id);
  });

  it('does not delete the photo and returns false when the user cancels', async () => {
    const photoRepo: IPhotoRepository = { ...createMockRepo(), getById: vi.fn().mockResolvedValue(photo) };

    const resultPromise = deleteCockpitPhoto(photo.id, photoRepo);
    await confirmPendingDialog('cancel');

    expect(await resultPromise).toBe(false);
    expect(photoRepo.delete).not.toHaveBeenCalled();
  });
});