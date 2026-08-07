import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadRouteListItems } from './route-list-sync.service.js';
import { fetchCloudRoutes, RouteCloudApiError } from '../../shared/http/route-cloud-api.service.js';
import type * as RouteCloudApiService from '../../shared/http/route-cloud-api.service.js';
import { MemoryRouteRepository } from '../../shared/repositories/memory-route.repository.js';
import { MemorySessionRepository } from '../../shared/repositories/memory-session.repository.js';

vi.mock('../../shared/http/route-cloud-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteCloudApiService>();
  return { ...actual, fetchCloudRoutes: vi.fn() };
});

const BASE_URL = 'http://localhost:8080';

describe('loadRouteListItems', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión activa, devuelve solo las rutas locales marcadas "local" y hasSession=false', async () => {
    const repository = new MemoryRouteRepository();
    await repository.save({ duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', visibility: 'private', origin: 'local' }, [], []);
    const sessionRepository = new MemorySessionRepository();

    const result = await loadRouteListItems(BASE_URL, repository, sessionRepository);

    expect(result.hasSession).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.syncState).toBe('local');
    expect(fetchCloudRoutes).not.toHaveBeenCalled();
  });

  it('sin repositorio de sesión (perfil no inicializado), se comporta igual que sin sesión', async () => {
    const repository = new MemoryRouteRepository();
    await repository.save({ duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', visibility: 'private', origin: 'local' }, [], []);

    const result = await loadRouteListItems(BASE_URL, repository, null);

    expect(result.hasSession).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.syncState).toBe('local');
  });

  it('con sesión activa, fusiona con las rutas de la nube', async () => {
    const repository = new MemoryRouteRepository();
    const saved = await repository.save({ duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', visibility: 'private', origin: 'local' }, [], []);
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });
    vi.mocked(fetchCloudRoutes).mockResolvedValue([
      { id: saved.id, createdAt: saved.createdAt, duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', name: null, notes: null },
      { id: 'cloud-only', createdAt: '2026-08-01T10:00:00.000Z', duration: 5, totalDistance: 5, avgSpeed: 5, status: 'completed', name: null, notes: null },
    ]);

    const result = await loadRouteListItems(BASE_URL, repository, sessionRepository);

    expect(result.hasSession).toBe(true);
    expect(result.items).toHaveLength(2);
    const byId = new Map(result.items.map((i) => [i.route.id, i.syncState]));
    expect(byId.get(saved.id)).toBe('synced');
    expect(byId.get('cloud-only')).toBe('cloud-only');
    expect(fetchCloudRoutes).toHaveBeenCalledWith(BASE_URL, 'jwt-token');
  });

  it('con sesión activa pero sin conexión, cae a solo rutas locales sin bloquearse (hasSession sigue true)', async () => {
    const repository = new MemoryRouteRepository();
    await repository.save({ duration: 1, totalDistance: 1, avgSpeed: 1, status: 'completed', visibility: 'private', origin: 'local' }, [], []);
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });
    vi.mocked(fetchCloudRoutes).mockRejectedValue(new RouteCloudApiError('network', 'network down'));

    const result = await loadRouteListItems(BASE_URL, repository, sessionRepository);

    expect(result.hasSession).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.syncState).toBe('local');
  });
});
