import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sendFriendRequest,
  listReceivedRequests,
  listSentRequests,
  listFriends,
  acceptFriendRequest,
  declineFriendRequest,
  revokeFriendRequest,
} from './friends-api.service.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('sendFriendRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía username con el Bearer del token', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ message: 'ok' }) });

    await sendFriendRequest(BASE_URL, TOKEN, 'friend1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/friends`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['username']).toBe('friend1');
  });

  it('lanza FriendsApiError kind "too-many-requests" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many friend requests' }) });

    await expect(sendFriendRequest(BASE_URL, TOKEN, 'friend1')).rejects.toMatchObject({ kind: 'too-many-requests' });
  });

  it('lanza FriendsApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    await expect(sendFriendRequest(BASE_URL, TOKEN, 'friend1')).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});

describe('listReceivedRequests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea la respuesta snake_case a camelCase', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'fr-1', from_username: 'sender1', created_at: '2026-08-23T10:00:00.000Z' }]),
    });

    const result = await listReceivedRequests(BASE_URL, TOKEN);

    expect(result).toEqual([{ id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' }]);
  });
});

describe('listSentRequests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapea la respuesta snake_case a camelCase, incluido el estado', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'fr-1', to_username: 'friend1', status: 'pending', created_at: '2026-08-23T10:00:00.000Z' }]),
    });

    const result = await listSentRequests(BASE_URL, TOKEN);

    expect(result).toEqual([{ id: 'fr-1', toUsername: 'friend1', status: 'pending', createdAt: '2026-08-23T10:00:00.000Z' }]);
  });
});

describe('listFriends', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve los amigos aceptados', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve([{ username: 'friend1' }]) });

    const result = await listFriends(BASE_URL, TOKEN);

    expect(result).toEqual([{ username: 'friend1' }]);
  });
});

describe('acceptFriendRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/friends/{id}/accept', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await acceptFriendRequest(BASE_URL, TOKEN, 'fr-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/friends/fr-1/accept`);
    expect(init.method).toBe('POST');
  });

  it('lanza FriendsApiError kind "not-found" en 404', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'friend request not found' }) });

    await expect(acceptFriendRequest(BASE_URL, TOKEN, 'fr-1')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('declineFriendRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/friends/{id}/decline', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await declineFriendRequest(BASE_URL, TOKEN, 'fr-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/friends/fr-1/decline`);
    expect(init.method).toBe('POST');
  });
});

describe('revokeFriendRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a POST /api/friends/{id}/revoke', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await revokeFriendRequest(BASE_URL, TOKEN, 'fr-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/friends/fr-1/revoke`);
    expect(init.method).toBe('POST');
  });
});
