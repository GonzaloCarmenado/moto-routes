import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkAchievements, fetchAchievements, AchievementApiError } from './achievement-api.service.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('checkAchievements', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía el Bearer del token y mapea los logros recién otorgados a camelCase', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            key: 'total_km_100',
            requirement_type: 'total_distance_km',
            threshold: 100,
            title: '100 km recorridos',
            description: 'Has superado los 100 km acumulados en tus rutas.',
            icon: 'default',
          },
        ]),
    });

    const result = await checkAchievements(BASE_URL, TOKEN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/achievements/check`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(result).toEqual([
      {
        id: 1,
        key: 'total_km_100',
        requirementType: 'total_distance_km',
        threshold: 100,
        title: '100 km recorridos',
        description: 'Has superado los 100 km acumulados en tus rutas.',
        icon: 'default',
      },
    ]);
  });

  it('devuelve un array vacío cuando no hay logros nuevos', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });

    const result = await checkAchievements(BASE_URL, TOKEN);

    expect(result).toEqual([]);
  });

  it('lanza AchievementApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = checkAchievements(BASE_URL, TOKEN);

    await expect(promise).rejects.toBeInstanceOf(AchievementApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza AchievementApiError kind "network" sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const promise = checkAchievements(BASE_URL, TOKEN);

    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchAchievements', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea el catálogo completo con el estado del usuario a camelCase', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            achievement: {
              id: 1,
              key: 'total_km_100',
              requirement_type: 'total_distance_km',
              threshold: 100,
              title: '100 km recorridos',
              description: 'Has superado los 100 km acumulados en tus rutas.',
              icon: 'default',
            },
            achieved_at: '2026-08-10T10:00:00Z',
            current: 100,
          },
          {
            achievement: {
              id: 2,
              key: 'total_km_500',
              requirement_type: 'total_distance_km',
              threshold: 500,
              title: '500 km recorridos',
              description: 'Has superado los 500 km acumulados en tus rutas.',
              icon: 'default',
            },
            achieved_at: null,
            current: 320,
          },
        ]),
    });

    const result = await fetchAchievements(BASE_URL, TOKEN);

    expect(result).toEqual([
      { achievement: expect.objectContaining({ key: 'total_km_100' }) as unknown, achievedAt: '2026-08-10T10:00:00Z', current: 100 },
      { achievement: expect.objectContaining({ key: 'total_km_500' }) as unknown, achievedAt: null, current: 320 },
    ]);
  });

  it('lanza AchievementApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = fetchAchievements(BASE_URL, TOKEN);

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
