import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { ISessionRepository } from '../../shared/models/session.repository.js';
import { fetchCloudRoutes } from '../../shared/http/route-cloud-api.service.js';
import { mergeLocalAndCloudRoutes, type RouteListItem } from './route-list-sync.transform.js';

/** Resultado de cargar el listado: las entradas y si hay sesión activa. */
export interface RouteListLoadResult {
  items: RouteListItem[];
  /**
   * Sin sesión activa no hay ningún concepto de nube que mostrar — el
   * listado se comporta exactamente igual que antes de este cambio, sin
   * ningún indicador de estado (ver spec `route-cloud-sync`).
   */
  hasSession: boolean;
}

/**
 * Carga el listado combinado local+nube: sin sesión activa, o si falla la
 * consulta a la nube (sin conexión), se comporta exactamente igual que hoy
 * (solo rutas locales, todas marcadas `'local'`) — un fallo de red nunca
 * bloquea ni rompe el listado local (ver spec `route-cloud-sync`).
 */
export async function loadRouteListItems(
  apiBaseUrl: string,
  repository: IRouteRepository,
  sessionRepository: ISessionRepository | null,
): Promise<RouteListLoadResult> {
  const local = await repository.getAll();
  const localOnly = (): RouteListItem[] => local.map((route) => ({ route, syncState: 'local' as const }));

  const session = sessionRepository ? await sessionRepository.get() : null;
  if (!session) return { items: localOnly(), hasSession: false };

  try {
    const cloud = await fetchCloudRoutes(apiBaseUrl, session.token);
    return { items: mergeLocalAndCloudRoutes(local, cloud), hasSession: true };
  } catch {
    return { items: localOnly(), hasSession: true };
  }
}
