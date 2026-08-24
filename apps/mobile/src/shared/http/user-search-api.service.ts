import { fetchJson, ExternalApiError } from './external-api.service.js';

/** Causa de un fallo al llamar a `GET /api/users/search`. */
export type UserSearchApiErrorKind = 'unauthorized' | 'too-many-requests' | 'network' | 'unknown';

/** Error tipado para fallos de la búsqueda de usuarios. */
export class UserSearchApiError extends Error {
  constructor(
    public readonly kind: UserSearchApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'UserSearchApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function mapStatus(status: number): UserSearchApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'too-many-requests';
  return 'unknown';
}

function toUserSearchApiError(err: unknown): UserSearchApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new UserSearchApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new UserSearchApiError('network', err.message);
    }
  }
  return new UserSearchApiError('unknown', err instanceof Error ? err.message : String(err));
}

/**
 * `GET /api/users/search` — busca usernames que contienen `query` (coincidencia
 * parcial, sin distinguir mayúsculas/minúsculas), acotado a 10 resultados por
 * el servidor (ver selector-amigos, design.md).
 */
export async function searchUsers(apiBaseUrl: string, token: string, query: string): Promise<string[]> {
  try {
    return await fetchJson<string[]>(`${apiBaseUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toUserSearchApiError(err);
  }
}
