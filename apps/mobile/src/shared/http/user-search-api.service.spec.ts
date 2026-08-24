import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchUsers, UserSearchApiError } from './user-search-api.service.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('searchUsers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta /api/users/search con q en la query string y el Bearer del token', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve(['rider1', 'rider2']) });

    const result = await searchUsers(BASE_URL, TOKEN, 'rider');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/users/search?q=rider`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(result).toEqual(['rider1', 'rider2']);
  });

  it('codifica caracteres especiales del término de búsqueda', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });

    await searchUsers(BASE_URL, TOKEN, 'a b&c');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/api/users/search?q=${encodeURIComponent('a b&c')}`);
  });

  it('lanza UserSearchApiError kind "too-many-requests" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many searches' }) });

    await expect(searchUsers(BASE_URL, TOKEN, 'rider')).rejects.toMatchObject({ kind: 'too-many-requests' });
  });

  it('lanza UserSearchApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = searchUsers(BASE_URL, TOKEN, 'rider');

    await expect(promise).rejects.toBeInstanceOf(UserSearchApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza UserSearchApiError kind "network" en fallo de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')));

    await expect(searchUsers(BASE_URL, TOKEN, 'rider')).rejects.toMatchObject({ kind: 'network' });
  });
});
