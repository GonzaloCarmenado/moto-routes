import { fetchJson, ExternalApiError } from './external-api.service.js';
import type { ReceivedRouteShareInvitation, SentRouteShareInvitation } from '../models/route-sharing.types.js';

/** Causa de un fallo al llamar a los endpoints de `/api/route-shares`. */
export type RouteSharingApiErrorKind = 'unauthorized' | 'not-found' | 'too-many-requests' | 'network' | 'unknown';

/** Error tipado para fallos de los endpoints de compartir rutas. */
export class RouteSharingApiError extends Error {
  constructor(
    public readonly kind: RouteSharingApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RouteSharingApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function toRouteSharingApiError(err: unknown): RouteSharingApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new RouteSharingApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new RouteSharingApiError('network', err.message);
    }
  }
  return new RouteSharingApiError('unknown', err instanceof Error ? err.message : String(err));
}

function mapStatus(status: number): RouteSharingApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 429) return 'too-many-requests';
  return 'unknown';
}

interface ReceivedInvitationResponse {
  id: string;
  route_id: string;
  route_name: string | null;
  route_created_at: string;
  from_email: string;
  created_at: string;
}

interface SentInvitationResponse {
  id: string;
  route_id: string;
  route_name: string | null;
  route_created_at: string;
  to_email: string;
  status: SentRouteShareInvitation['status'];
  created_at: string;
}

interface AcceptResponse {
  route_id: string;
}

/**
 * `POST /api/route-shares` — invita a otra cuenta (por username, elegida con
 * el selector de búsqueda, ver selector-amigos) a recibir una copia de una
 * ruta ya sincronizada. La respuesta es siempre genérica en el servidor
 * (nunca revela si el username existe) — este servicio solo propaga errores
 * de red/sesión/límite de invitaciones, no de "username no encontrado".
 */
export async function createInvitation(apiBaseUrl: string, token: string, routeId: string, username: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/route-shares`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
      body: { route_id: routeId, username },
    });
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}

/** `GET /api/route-shares/received` — invitaciones pendientes recibidas por el usuario autenticado. */
export async function fetchReceivedInvitations(apiBaseUrl: string, token: string): Promise<ReceivedRouteShareInvitation[]> {
  try {
    const response = await fetchJson<ReceivedInvitationResponse[]>(`${apiBaseUrl}/api/route-shares/received`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map((r) => ({
      id: r.id,
      routeId: r.route_id,
      routeName: r.route_name,
      routeCreatedAt: r.route_created_at,
      fromEmail: r.from_email,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}

/** `GET /api/route-shares/sent` — invitaciones enviadas por el usuario autenticado, con su estado. */
export async function fetchSentInvitations(apiBaseUrl: string, token: string): Promise<SentRouteShareInvitation[]> {
  try {
    const response = await fetchJson<SentInvitationResponse[]>(`${apiBaseUrl}/api/route-shares/sent`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map((r) => ({
      id: r.id,
      routeId: r.route_id,
      routeName: r.route_name,
      routeCreatedAt: r.route_created_at,
      toEmail: r.to_email,
      status: r.status,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}

/**
 * `POST /api/route-shares/{id}/accept` — acepta una invitación pendiente,
 * clonando la ruta completa en la cuenta del usuario autenticado. Devuelve
 * el id de la ruta clonada.
 */
export async function acceptInvitation(apiBaseUrl: string, token: string, invitationId: string): Promise<string> {
  try {
    const response = await fetchJson<AcceptResponse>(`${apiBaseUrl}/api/route-shares/${invitationId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.route_id;
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}

/** `POST /api/route-shares/{id}/decline` — rechaza una invitación pendiente, sin clonar nada. */
export async function declineInvitation(apiBaseUrl: string, token: string, invitationId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/route-shares/${invitationId}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}

/** `POST /api/route-shares/{id}/revoke` — revoca una invitación pendiente enviada por el usuario autenticado. */
export async function revokeInvitation(apiBaseUrl: string, token: string, invitationId: string): Promise<void> {
  try {
    await fetchJson(`${apiBaseUrl}/api/route-shares/${invitationId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
  } catch (err) {
    throw toRouteSharingApiError(err);
  }
}
