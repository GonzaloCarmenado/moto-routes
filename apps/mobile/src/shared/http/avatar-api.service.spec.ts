import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadAccountAvatar, fetchAccountAvatar, AvatarApiError } from './avatar-api.service.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('uploadAccountAvatar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía un FormData con el campo avatar y el Bearer del token a POST /api/auth/avatar', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({}) });
    const file = new Blob(['x'], { type: 'image/png' });

    await uploadAccountAvatar(BASE_URL, TOKEN, file, 'avatar.png');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/auth/avatar`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    const body = init.body as FormData;
    expect(body.get('avatar')).toBeInstanceOf(Blob);
  });

  it('lanza AvatarApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, headers: { get: () => null }, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = uploadAccountAvatar(BASE_URL, TOKEN, new Blob(['x']), 'avatar.png');

    await expect(promise).rejects.toBeInstanceOf(AvatarApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza AvatarApiError kind "too-large" en 400', async () => {
    stubFetch({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: () => Promise.resolve({ error: 'avatar exceeds the maximum allowed size' }),
    });

    const promise = uploadAccountAvatar(BASE_URL, TOKEN, new Blob(['x']), 'avatar.png');

    await expect(promise).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('lanza AvatarApiError kind "network" sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const promise = uploadAccountAvatar(BASE_URL, TOKEN, new Blob(['x']), 'avatar.png');

    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchAccountAvatar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama GET a /api/auth/avatar con el Bearer del token y devuelve el Blob', async () => {
    const avatarBlob = new Blob(['png bytes'], { type: 'application/octet-stream' });
    const fetchMock = stubFetch({ ok: true, status: 200, blob: () => Promise.resolve(avatarBlob) });

    const result = await fetchAccountAvatar(BASE_URL, TOKEN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/auth/avatar`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(result).toBe(avatarBlob);
  });

  it('lanza AvatarApiError kind "not-found" en 404 (cuenta sin avatar configurado)', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'no avatar configured for this account' }) });

    const promise = fetchAccountAvatar(BASE_URL, TOKEN);

    await expect(promise).rejects.toBeInstanceOf(AvatarApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('lanza AvatarApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = fetchAccountAvatar(BASE_URL, TOKEN);

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza AvatarApiError kind "network" sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const promise = fetchAccountAvatar(BASE_URL, TOKEN);

    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
});
