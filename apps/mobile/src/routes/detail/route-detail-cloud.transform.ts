import type { Route, RoutePoint, RouteStop } from '../../shared/models/route.types.js';
import type { CloudRouteDetail } from '../../shared/http/route-cloud-api.service.js';

/** Datos de una ruta de la nube, adaptados a los tipos locales para poder
 * reutilizar el mismo render (mapa, timeline) que una ruta del dispositivo. */
export interface LocalizedCloudRoute {
  route: Route;
  points: RoutePoint[];
  stops: RouteStop[];
}

/**
 * Adapta el detalle completo de una ruta de la nube a `Route`/`RoutePoint[]`/
 * `RouteStop[]`. Los `id` de puntos/paradas se sintetizan (el servidor no
 * expone los suyos, de solo lectura para este cambio): son puramente de
 * presentación, nunca se persisten ni se reenvían al servidor.
 */
export function cloudRouteDetailToLocal(detail: CloudRouteDetail): LocalizedCloudRoute {
  const route: Route = {
    id: detail.id,
    createdAt: detail.createdAt,
    duration: detail.duration,
    totalDistance: detail.totalDistance,
    avgSpeed: detail.avgSpeed,
    status: detail.status as Route['status'],
    visibility: 'private',
    origin: 'remote',
    previewPolyline: null,
    name: detail.name,
    notes: detail.notes,
    isFavorite: detail.isFavorite,
  };

  const points: RoutePoint[] = detail.points.map((p) => ({
    id: crypto.randomUUID(),
    routeId: detail.id,
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    speed: p.speed,
  }));

  const stops: RouteStop[] = detail.stops.map((s) => ({
    id: crypto.randomUUID(),
    routeId: detail.id,
    startTime: s.startTime,
    endTime: s.endTime,
    lat: s.lat,
    lng: s.lng,
    type: s.type as RouteStop['type'],
    stopCategoryId: s.stopCategoryId,
  }));

  return { route, points, stops };
}
