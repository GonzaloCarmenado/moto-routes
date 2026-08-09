import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPhotoRepository } from './memory-photo.repository.js';
import type { CreatePhoto } from '../models/photo.types.js';

function makeCreatePhoto(overrides?: Partial<CreatePhoto>): CreatePhoto {
  return {
    routeId: 'route-1',
    filePath: '/photos/photo-1.jpg',
    latitude: 40.416775,
    longitude: -3.70379,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MemoryPhotoRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('add() inicializa remotePhotoId a null', async () => {
    const repo = new MemoryPhotoRepository();

    const photo = await repo.add(makeCreatePhoto());

    expect(photo.remotePhotoId).toBeNull();
  });

  it('markPhotoSynced() guarda el id remoto y se refleja en getById/getByRouteId', async () => {
    const repo = new MemoryPhotoRepository();
    const photo = await repo.add(makeCreatePhoto());

    await repo.markPhotoSynced(photo.id, 'remote-photo-1');

    const byId = await repo.getById(photo.id);
    expect(byId?.remotePhotoId).toBe('remote-photo-1');
    const byRoute = await repo.getByRouteId('route-1');
    expect(byRoute[0]?.remotePhotoId).toBe('remote-photo-1');
  });

  it('markPhotoSynced() en un id inexistente no lanza ni afecta a otras fotos', async () => {
    const repo = new MemoryPhotoRepository();
    const photo = await repo.add(makeCreatePhoto());

    await expect(repo.markPhotoSynced('no-existe', 'remote-photo-1')).resolves.toBeUndefined();

    const byId = await repo.getById(photo.id);
    expect(byId?.remotePhotoId).toBeNull();
  });
});
