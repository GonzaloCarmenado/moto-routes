import { fetchJson, ExternalApiError } from './external-api.service.js';
import type { ReceivedFriendRequest, SentFriendRequest, Friend } from '../models/friends.types.js';

/** Causa de un fallo al llamar a los endpoints de `/api/friends`. */
export type FriendsApiErrorKind = 'unauthorized' | 'not-found' | 'too-many-requests' | 'network' | 'unknown';

/** Error tipado para fallos de los endpoints de amigos. */
export class FriendsApiError extends Error {
  constructor(
    public readonly kind: FriendsApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'FriendsApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function toFriendsApiError(err: unknown): FriendsApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new FriendsApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new FriendsApiError('network', err.message);
    }
  }
  return new FriendsApiError('unknown', err instanceof Error ? err.message : String(err));
}

function mapStatus(status: number): FriendsApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 429) return 'too-many-requests';
  return 'unknown';
}

interface ReceivedRequestResponse {
  id: string;
  from_username: string;
  created_at: string;
}

interface SentRequestResponse {
  id: string;
  to_username: string;
  status: SentFriendRequest['status'];
  created_at: string;
}

interface FriendResponse {
  username: string;
}

/**
 * `POST /api/friends` — envía una solicitud de amistad a otra cuenta por su
 * username. La respuesta es siempre genérica en el servidor (nunca revela si
 * el username existe) — este servicio solo propaga errores de red/sesión/
 * límite de solicitudes, no de "username no encontrado".
 */
export async function sendFriendRequest(apiBaseUrl: string, token: string, username: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/friends`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
      body: { username },
    });
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `GET /api/friends/received` — solicitudes de amistad pendientes recibidas por el usuario autenticado. */
export async function listReceivedRequests(apiBaseUrl: string, token: string): Promise<ReceivedFriendRequest[]> {
  try {
    const response = await fetchJson<ReceivedRequestResponse[]>(`${apiBaseUrl}/api/friends/received`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map((r) => ({ id: r.id, fromUsername: r.from_username, createdAt: r.created_at }));
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `GET /api/friends/sent` — solicitudes de amistad enviadas por el usuario autenticado, con su estado. */
export async function listSentRequests(apiBaseUrl: string, token: string): Promise<SentFriendRequest[]> {
  try {
    const response = await fetchJson<SentRequestResponse[]>(`${apiBaseUrl}/api/friends/sent`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map((r) => ({ id: r.id, toUsername: r.to_username, status: r.status, createdAt: r.created_at }));
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `GET /api/friends` — amigos ya aceptados del usuario autenticado. */
export async function listFriends(apiBaseUrl: string, token: string): Promise<Friend[]> {
  try {
    const response = await fetchJson<FriendResponse[]>(`${apiBaseUrl}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map((r) => ({ username: r.username }));
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `POST /api/friends/{id}/accept` — acepta una solicitud de amistad pendiente. */
export async function acceptFriendRequest(apiBaseUrl: string, token: string, requestId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/friends/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `POST /api/friends/{id}/decline` — rechaza una solicitud de amistad pendiente. */
export async function declineFriendRequest(apiBaseUrl: string, token: string, requestId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/friends/${requestId}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toFriendsApiError(err);
  }
}

/** `POST /api/friends/{id}/revoke` — revoca una solicitud de amistad pendiente enviada por el usuario autenticado. */
export async function revokeFriendRequest(apiBaseUrl: string, token: string, requestId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/friends/${requestId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toFriendsApiError(err);
  }
}
