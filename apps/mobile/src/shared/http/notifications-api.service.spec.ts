import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerDeviceToken } from './notifications-api.service.js';

const BASE_URL = 'http://localhost:8080';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('registerDeviceToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía el token de sesión y el token de dispositivo al endpoint correcto', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ status: 'registered' }) });

    await registerDeviceToken(BASE_URL, 'jwt-token', 'fcm-device-token', 'android');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/device-tokens`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'fcm-device-token', platform: 'android' });
  });

  it('propaga el error si el servidor responde con fallo', async () => {
    const fetchMock = stubFetch({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) });
    void fetchMock;

    await expect(registerDeviceToken(BASE_URL, 'jwt-token', 'fcm-device-token', 'android')).rejects.toThrow();
  });
});
