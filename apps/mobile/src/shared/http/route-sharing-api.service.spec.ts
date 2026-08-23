import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createInvitation,
  fetchReceivedInvitations,
  fetchSentInvitations,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
} from './route-sharing-api.service.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('createInvitation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía route_id y username con el Bearer del token', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ message: 'ok' }) });

    await createInvitation(BASE_URL, TOKEN, 'route-1', 'friend1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/route-shares`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['route_id']).toBe('route-1');
    expect(body['username']).toBe('friend1');
  });

  it('lanza RouteSharingApiError kind "too-many-requests" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many invitations' }) });

    await expect(createInvitation(BASE_URL, TOKEN, 'route-1', 'friend1')).rejects.toMatchObject({
      kind: 'too-many-requests',
    });
  });

  it('lanza RouteSharingApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    await expect(createInvitation(BASE_URL, TOKEN, 'route-1', 'friend1')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });
});

describe('fetchReceivedInvitations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea la respuesta snake_case a camelCase', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { id: 'inv-1', route_id: 'route-1', route_name: 'Ruta compartida', route_created_at: '2026-08-14T10:00:00.000Z', from_email: 'sender@example.com', created_at: '2026-08-14T11:00:00.000Z' },
        ]),
    });

    const result = await fetchReceivedInvitations(BASE_URL, TOKEN);

    expect(result).toEqual([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta compartida', routeCreatedAt: '2026-08-14T10:00:00.000Z', fromEmail: 'sender@example.com', createdAt: '2026-08-14T11:00:00.000Z' },
    ]);
  });
});

describe('fetchSentInvitations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea la respuesta snake_case a camelCase, incluido el estado', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { id: 'inv-1', route_id: 'route-1', route_name: 'Ruta enviada', route_created_at: '2026-08-14T10:00:00.000Z', to_email: 'friend@example.com', status: 'pending', created_at: '2026-08-14T11:00:00.000Z' },
        ]),
    });

    const result = await fetchSentInvitations(BASE_URL, TOKEN);

    expect(result).toEqual([
      { id: 'inv-1', routeId: 'route-1', routeName: 'Ruta enviada', routeCreatedAt: '2026-08-14T10:00:00.000Z', toEmail: 'friend@example.com', status: 'pending', createdAt: '2026-08-14T11:00:00.000Z' },
    ]);
  });
});

describe('acceptInvitation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/route-shares/{id}/accept y devuelve el id de la ruta clonada', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ route_id: 'cloned-route-1' }) });

    const result = await acceptInvitation(BASE_URL, TOKEN, 'inv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/route-shares/inv-1/accept`);
    expect(init.method).toBe('POST');
    expect(result).toBe('cloned-route-1');
  });

  it('lanza RouteSharingApiError kind "not-found" en 404', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'invitation not found' }) });

    await expect(acceptInvitation(BASE_URL, TOKEN, 'inv-1')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('declineInvitation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/route-shares/{id}/decline', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await declineInvitation(BASE_URL, TOKEN, 'inv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/route-shares/inv-1/decline`);
    expect(init.method).toBe('POST');
  });
});

describe('revokeInvitation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/route-shares/{id}/revoke', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await revokeInvitation(BASE_URL, TOKEN, 'inv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/route-shares/inv-1/revoke`);
    expect(init.method).toBe('POST');
  });
});
