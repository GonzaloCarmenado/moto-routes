import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadRouteToCloud, loadCloudRouteDetail, checkIfRouteIsSynced, autoResyncIfNeeded } from './route-detail-cloud.service.js';
import { uploadRoute, fetchCloudRouteDetail, fetchCloudRoutes, RouteCloudApiError } from '../../shared/http/route-cloud-api.service.js';
import type * as RouteCloudApiService from '../../shared/http/route-cloud-api.service.js';
import { showToast } from '../../shared/feedback/toast.js';
import { MemoryRouteRepository } from '../../shared/repositories/memory-route.repository.js';

vi.mock('../../shared/http/route-cloud-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteCloudApiService>();
  return { ...actual, uploadRoute: vi.fn(), fetchCloudRouteDetail: vi.fn(), fetchCloudRoutes: vi.fn() };
});

vi.mock('../../shared/feedback/toast.js', () => ({ showToast: vi.fn((): (() => void) => (): void => undefined) }));

const BASE_URL = 'http://localhost:8080';
const SESSION = { token: 'jwt-token', email: 'rider@example.com' };

describe('uploadRouteToCloud', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lee los puntos/paradas del repositorio local y los sube junto a la ruta', async () => {
    const repository = new MemoryRouteRepository();
    const routeId = crypto.randomUUID();
    const route = await repository.save(
      { id: routeId, duration: 100, totalDistance: 10, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [{ routeId, timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 }],
      [{ routeId, startTime: 1200, endTime: 1300, lat: 40.15, lng: -3.15, type: 'manual', stopCategoryId: 1 }],
    );

    await uploadRouteToCloud(BASE_URL, SESSION, repository, route);

    expect(uploadRoute).toHaveBeenCalledWith(BASE_URL, SESSION.token, {
      route,
      points: [expect.objectContaining({ lat: 40.1 })],
      stops: [expect.objectContaining({ startTime: 1200 })],
    });
  });

  it('propaga el error si la subida falla (sin conexión, límite de puntos, etc.)', async () => {
    const repository = new MemoryRouteRepository();
    const route = await repository.save(
      { duration: 100, totalDistance: 10, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
    vi.mocked(uploadRoute).mockRejectedValue(new Error('network down'));

    await expect(uploadRouteToCloud(BASE_URL, SESSION, repository, route)).rejects.toThrow('network down');
  });
});

describe('loadCloudRouteDetail', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('descarga y adapta el detalle a los tipos locales', async () => {
    vi.mocked(fetchCloudRouteDetail).mockResolvedValue({
      id: 'cloud-1',
      createdAt: '2026-08-01T10:00:00.000Z',
      duration: 60,
      totalDistance: 10,
      avgSpeed: 30,
      status: 'completed',
      name: null,
      notes: null,
      points: [{ timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 }],
      stops: [],
    });

    const result = await loadCloudRouteDetail(BASE_URL, SESSION, 'cloud-1');

    expect(result.error).toBeUndefined();
    expect('route' in result && result.route.origin).toBe('remote');
    expect('points' in result && result.points).toHaveLength(1);
  });

  it('nunca lanza: un fallo de red se convierte en { error }', async () => {
    vi.mocked(fetchCloudRouteDetail).mockRejectedValue(new RouteCloudApiError('network', 'network down'));

    const result = await loadCloudRouteDetail(BASE_URL, SESSION, 'cloud-1');

    expect(result.error).toBe('network down');
  });
});

describe('checkIfRouteIsSynced', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve true si el id de la ruta aparece en el resumen de la nube', async () => {
    vi.mocked(fetchCloudRoutes).mockResolvedValue([
      { id: 'route-1', createdAt: '2026-08-01T10:00:00.000Z', duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', name: null, notes: null },
    ]);

    await expect(checkIfRouteIsSynced(BASE_URL, SESSION, 'route-1')).resolves.toBe(true);
  });

  it('devuelve false si el id no aparece en el resumen de la nube', async () => {
    vi.mocked(fetchCloudRoutes).mockResolvedValue([]);

    await expect(checkIfRouteIsSynced(BASE_URL, SESSION, 'route-1')).resolves.toBe(false);
  });

  it('ante un fallo de red, devuelve false en vez de lanzar', async () => {
    vi.mocked(fetchCloudRoutes).mockRejectedValue(new RouteCloudApiError('network', 'network down'));

    await expect(checkIfRouteIsSynced(BASE_URL, SESSION, 'route-1')).resolves.toBe(false);
  });
});

describe('autoResyncIfNeeded', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('si la ruta ya estaba sincronizada, la vuelve a subir sin ningún toast de éxito', async () => {
    const repository = new MemoryRouteRepository();
    const route = await repository.save(
      { duration: 100, totalDistance: 10, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    vi.mocked(uploadRoute).mockResolvedValue(undefined);

    await autoResyncIfNeeded({ apiBaseUrl: BASE_URL, session: SESSION, repository, route, isSynced: true });

    expect(uploadRoute).toHaveBeenCalledOnce();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('si la ruta nunca se ha subido, no hace nada', async () => {
    const repository = new MemoryRouteRepository();
    const route = await repository.save(
      { duration: 100, totalDistance: 10, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );

    await autoResyncIfNeeded({ apiBaseUrl: BASE_URL, session: SESSION, repository, route, isSynced: false });

    expect(uploadRoute).not.toHaveBeenCalled();
  });

  it('si la re-subida falla, muestra un aviso discreto sin lanzar', async () => {
    const repository = new MemoryRouteRepository();
    const route = await repository.save(
      { duration: 100, totalDistance: 10, avgSpeed: 40, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    vi.mocked(uploadRoute).mockRejectedValue(new Error('network down'));

    await expect(autoResyncIfNeeded({ apiBaseUrl: BASE_URL, session: SESSION, repository, route, isSynced: true })).resolves.toBeUndefined();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('network down'), 'error');
  });
});
