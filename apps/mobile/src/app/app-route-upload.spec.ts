import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleRouteSaved } from './app-route-upload.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Route } from '../shared/models/route.types.js';

vi.mock('../routes/detail/route-detail-cloud.service.js', () => ({
  uploadRouteToCloud: vi.fn(),
}));
import { uploadRouteToCloud } from '../routes/detail/route-detail-cloud.service.js';

vi.mock('../shared/feedback/route-upload-snackbar.js', () => ({
  showRouteUploadSnackbar: vi.fn(),
}));
import { showRouteUploadSnackbar } from '../shared/feedback/route-upload-snackbar.js';

vi.mock('../auth/session-refresh.service.js', () => ({
  ensureFreshSession: vi.fn((_apiBaseUrl: string, _repo: unknown, session: unknown) => Promise.resolve(session)),
}));
import { ensureFreshSession } from '../auth/session-refresh.service.js';

const ROUTE: Route = {
  id: 'route-1',
  createdAt: '2026-08-23T10:00:00.000Z',
  duration: 1800,
  totalDistance: 12000,
  avgSpeed: 42,
  status: 'completed',
  visibility: 'private',
  origin: 'local',
  previewPolyline: null,
  name: 'Ruta test',
  notes: null,
  isFavorite: false,
};

function createRepository(route: Route | null = ROUTE): IRouteRepository {
  return {
    getById: vi.fn().mockResolvedValue(route),
  } as unknown as IRouteRepository;
}

function createSessionRepository(session: { token: string; email: string } | null): ISessionRepository {
  return {
    get: vi.fn().mockResolvedValue(session),
  } as unknown as ISessionRepository;
}

describe('handleRouteSaved', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing without an active session (no snackbar, no upload)', async () => {
    const sessionRepository = createSessionRepository(null);
    const repository = createRepository();

    await handleRouteSaved({ apiBaseUrl: 'http://localhost:8080', sessionRepository, repository, routeId: 'route-1' });

    expect(showRouteUploadSnackbar).not.toHaveBeenCalled();
    expect(uploadRouteToCloud).not.toHaveBeenCalled();
  });

  it('with an active session, shows the snackbar and uploads the route', async () => {
    const sessionRepository = createSessionRepository({ token: 'jwt-token', email: 'me@example.com' });
    const repository = createRepository();
    const succeed = vi.fn();
    vi.mocked(showRouteUploadSnackbar).mockReturnValue({ succeed, fail: vi.fn() });
    vi.mocked(uploadRouteToCloud).mockResolvedValue([]);

    await handleRouteSaved({ apiBaseUrl: 'http://localhost:8080', sessionRepository, repository, routeId: 'route-1' });

    expect(showRouteUploadSnackbar).toHaveBeenCalledWith('Subiendo ruta…');
    expect(uploadRouteToCloud).toHaveBeenCalledWith('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' }, repository, ROUTE);
    expect(succeed).toHaveBeenCalledOnce();
  });

  it('renueva la sesión de forma proactiva antes de subir, si hace falta (renovacion-token-sesion)', async () => {
    const expiredSession = { token: 'jwt-old', email: 'me@example.com', refreshToken: 'refresh-old', expiresAt: 1 };
    const refreshedSession = { token: 'jwt-new', email: 'me@example.com', refreshToken: 'refresh-new', expiresAt: Date.now() + 60000 };
    const sessionRepository = createSessionRepository(expiredSession);
    const repository = createRepository();
    vi.mocked(showRouteUploadSnackbar).mockReturnValue({ succeed: vi.fn(), fail: vi.fn() });
    vi.mocked(uploadRouteToCloud).mockResolvedValue([]);
    vi.mocked(ensureFreshSession).mockResolvedValue(refreshedSession);

    await handleRouteSaved({ apiBaseUrl: 'http://localhost:8080', sessionRepository, repository, routeId: 'route-1' });

    expect(ensureFreshSession).toHaveBeenCalledWith('http://localhost:8080', sessionRepository, expiredSession);
    expect(uploadRouteToCloud).toHaveBeenCalledWith('http://localhost:8080', refreshedSession, repository, ROUTE);
  });

  it('a failed upload transitions the snackbar to fail(), without throwing', async () => {
    const sessionRepository = createSessionRepository({ token: 'jwt-token', email: 'me@example.com' });
    const repository = createRepository();
    const fail = vi.fn();
    vi.mocked(showRouteUploadSnackbar).mockReturnValue({ succeed: vi.fn(), fail });
    vi.mocked(uploadRouteToCloud).mockRejectedValue(new Error('Network error'));

    await expect(handleRouteSaved({ apiBaseUrl: 'http://localhost:8080', sessionRepository, repository, routeId: 'route-1' })).resolves.toBeUndefined();

    expect(fail).toHaveBeenCalledOnce();
  });

  it('does nothing if the route cannot be found in the repository (defensive, should not happen)', async () => {
    const sessionRepository = createSessionRepository({ token: 'jwt-token', email: 'me@example.com' });
    const repository = createRepository(null);

    await handleRouteSaved({ apiBaseUrl: 'http://localhost:8080', sessionRepository, repository, routeId: 'route-1' });

    expect(showRouteUploadSnackbar).not.toHaveBeenCalled();
    expect(uploadRouteToCloud).not.toHaveBeenCalled();
  });
});
