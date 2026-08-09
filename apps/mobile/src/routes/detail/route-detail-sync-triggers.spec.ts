import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerAutoResync, triggerPhotoUpload, triggerPhotoDelete, type SyncTriggerContext } from './route-detail-sync-triggers.js';
import { autoResyncIfNeeded, uploadPhotoToCloud, deletePhotoFromCloud } from './route-detail-cloud.service.js';
import type * as RouteDetailCloudService from './route-detail-cloud.service.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Photo } from '../../shared/models/photo.types.js';

vi.mock('./route-detail-cloud.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteDetailCloudService>();
  return { ...actual, autoResyncIfNeeded: vi.fn(), uploadPhotoToCloud: vi.fn(), deletePhotoFromCloud: vi.fn() };
});

const SESSION = { token: 'jwt-token', email: 'rider@example.com' };
const ROUTE_REPO = {} as IRouteRepository;
const PHOTO_REPO = {} as IPhotoRepository;
const ROUTE = { id: 'route-1' } as Route;
const PHOTO = { id: 'photo-1', filePath: '/a.jpg' } as Photo;

function makeContext(overrides?: Partial<SyncTriggerContext>): SyncTriggerContext {
  return { session: SESSION, routeId: 'route-1', repository: ROUTE_REPO, isSynced: true, ...overrides };
}

describe('triggerAutoResync', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a autoResyncIfNeeded con el contexto dado', () => {
    triggerAutoResync(makeContext(), ROUTE);

    expect(autoResyncIfNeeded).toHaveBeenCalledWith(expect.objectContaining({ session: SESSION, repository: ROUTE_REPO, route: ROUTE, isSynced: true }));
  });

  it('no hace nada sin sesión activa', () => {
    triggerAutoResync(makeContext({ session: null }), ROUTE);
    expect(autoResyncIfNeeded).not.toHaveBeenCalled();
  });

  it('no hace nada sin repositorio', () => {
    triggerAutoResync(makeContext({ repository: null }), ROUTE);
    expect(autoResyncIfNeeded).not.toHaveBeenCalled();
  });
});

describe('triggerPhotoUpload', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a uploadPhotoToCloud con el contexto dado', async () => {
    await triggerPhotoUpload(makeContext(), PHOTO_REPO, PHOTO);

    expect(uploadPhotoToCloud).toHaveBeenCalledWith(expect.objectContaining({ session: SESSION, photoRepo: PHOTO_REPO, routeId: 'route-1', photo: PHOTO, isSynced: true }));
  });

  it('no hace nada sin sesión activa', async () => {
    await triggerPhotoUpload(makeContext({ session: null }), PHOTO_REPO, PHOTO);
    expect(uploadPhotoToCloud).not.toHaveBeenCalled();
  });

  it('no hace nada sin routeId', async () => {
    await triggerPhotoUpload(makeContext({ routeId: null }), PHOTO_REPO, PHOTO);
    expect(uploadPhotoToCloud).not.toHaveBeenCalled();
  });
});

describe('triggerPhotoDelete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a deletePhotoFromCloud con el contexto dado', () => {
    triggerPhotoDelete(makeContext(), 'remote-photo-1');

    expect(deletePhotoFromCloud).toHaveBeenCalledWith(expect.objectContaining({ session: SESSION, routeId: 'route-1', remotePhotoId: 'remote-photo-1', isSynced: true }));
  });

  it('no hace nada sin sesión activa', () => {
    triggerPhotoDelete(makeContext({ session: null }), 'remote-photo-1');
    expect(deletePhotoFromCloud).not.toHaveBeenCalled();
  });

  it('no hace nada sin routeId', () => {
    triggerPhotoDelete(makeContext({ routeId: null }), 'remote-photo-1');
    expect(deletePhotoFromCloud).not.toHaveBeenCalled();
  });
});
