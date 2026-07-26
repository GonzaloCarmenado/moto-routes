import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { simplifyPolyline } from '../shared/services/route-polyline.service.js';

/**
 * Único punto de decisión de "¿ya tiene trazado / hay que calcularlo / no hay
 * datos disponibles?" para el backfill perezoso del listado de rutas —
 * `route-list.element.ts` no debe reimplementar esta lógica de guarda.
 *
 * - Si `route.previewPolyline` ya está calculado (no es `null`, aunque esté
 *   vacío), se devuelve tal cual sin volver a pedir puntos ni recalcular.
 * - Si no, se piden los `route_points` y, si existen, se simplifica el
 *   trazado y se persiste en segundo plano vía `updatePreviewPolyline`.
 * - Si la ruta no tiene ningún `route_point`, devuelve `null` sin lanzar y
 *   sin persistir nada (caso AC-024).
 */
export async function ensurePreviewPolyline(
  repository: IRouteRepository,
  route: Route,
): Promise<[number, number][] | null> {
  if (route.previewPolyline !== null) {
    return route.previewPolyline;
  }

  const points = await repository.getPointsByRouteId(route.id);
  if (points.length === 0) return null;

  const polyline = simplifyPolyline(points);
  await repository.updatePreviewPolyline(route.id, polyline);
  return polyline;
}
