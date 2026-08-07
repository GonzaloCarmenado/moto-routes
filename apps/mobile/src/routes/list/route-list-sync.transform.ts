import type { Route } from '../../shared/models/route.types.js';
import type { CloudRouteSummary } from '../../shared/http/route-cloud-api.service.js';

/** Estado de sincronización de una entrada del listado combinado. */
export type RouteSyncState = 'local' | 'synced' | 'cloud-only';

/** Entrada del listado combinado: la ruta a renderizar junto a su estado. */
export interface RouteListItem {
  route: Route;
  syncState: RouteSyncState;
}

/**
 * Fusiona las rutas locales de este dispositivo con los resúmenes de la
 * cuenta del usuario, sin duplicar ninguna entrada — casadas por `id`.
 * Pura: no hace ninguna llamada de red ni de repositorio (ver
 * `route-list-sync.service.ts` para la orquestación).
 */
export function mergeLocalAndCloudRoutes(local: Route[], cloud: CloudRouteSummary[]): RouteListItem[] {
  const cloudByID = new Map(cloud.map((c) => [c.id, c]));
  const localIds = new Set(local.map((r) => r.id));

  const items: RouteListItem[] = local.map((route) => ({
    route,
    syncState: cloudByID.has(route.id) ? 'synced' : 'local',
  }));

  for (const summary of cloud) {
    if (localIds.has(summary.id)) continue;
    items.push({ route: cloudSummaryToRoute(summary), syncState: 'cloud-only' });
  }

  // Sin esto, una ruta cloud-only siempre acababa al final de la lista sin
  // importar su fecha — gap real encontrado verificando en dispositivo real
  // (una ruta "de hoy" aparecía por debajo de rutas locales antiguas).
  return items.sort((a, b) => b.route.createdAt.localeCompare(a.route.createdAt));
}

/**
 * Adapta un resumen de la nube al tipo `Route` para poder reutilizar el
 * mismo renderizado de tarjeta que una ruta local. `previewPolyline: null`
 * (nunca dispara backfill — no hay puntos locales de los que calcularlo) y
 * `origin: 'remote'` distinguen una ruta exclusiva de la nube de una local.
 */
function cloudSummaryToRoute(summary: CloudRouteSummary): Route {
  return {
    id: summary.id,
    createdAt: summary.createdAt,
    duration: summary.duration,
    totalDistance: summary.totalDistance,
    avgSpeed: summary.avgSpeed,
    status: summary.status as Route['status'],
    visibility: 'private',
    origin: 'remote',
    previewPolyline: null,
    name: summary.name,
    notes: summary.notes,
  };
}
