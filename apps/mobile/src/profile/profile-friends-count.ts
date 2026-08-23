/**
 * Recuento de solicitudes de amistad pendientes recibidas, para el badge del
 * punto de acceso "Amigos" en Perfil — mismo patrón best-effort que
 * `route-list-sharing.ts::hasPendingReceivedInvitations`: sin sesión, o si
 * la petición falla (p. ej. sin conexión), se trata como "0 pendientes" en
 * vez de romper la pantalla.
 */
import type { Session } from '../shared/models/session.types.js';
import { listReceivedRequests } from '../shared/http/friends-api.service.js';

/** Número de solicitudes de amistad pendientes recibidas, `0` sin sesión o si la petición falla. */
export async function countPendingFriendRequests(apiBaseUrl: string, session: Session | null): Promise<number> {
  if (!session) return 0;
  try {
    const received = await listReceivedRequests(apiBaseUrl, session.token);
    return received.length;
  } catch {
    return 0;
  }
}
