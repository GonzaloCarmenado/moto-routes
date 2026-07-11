import type { IRouteRepository } from '../models/route.repository.js';
import type {
  Route,
  RoutePoint,
  RouteStop,
  CreateRoute,
  CreateRoutePoint,
  CreateRouteStop,
} from '../models/route.types.js';

/**
 * Implementación en memoria de IRouteRepository.
 * Usada para tests y desarrollo web (sin Tauri).
 * NO persistente — los datos se pierden al recargar la página.
 */
export class MemoryRouteRepository implements IRouteRepository {
  private readonly routes = new Map<string, Route>();
  private readonly points = new Map<string, RoutePoint[]>();
  private readonly stops = new Map<string, RouteStop[]>();
  private insertOrder = 0;
  private readonly orderMap = new Map<string, number>();

  save(
    route: CreateRoute,
    points: CreateRoutePoint[],
    stops: CreateRouteStop[],
  ): Promise<Route> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const savedRoute: Route = { id, createdAt, ...route };
    this.routes.set(id, savedRoute);
    this.orderMap.set(id, this.insertOrder++);

    const savedPoints: RoutePoint[] = points.map((p) => ({
      id: crypto.randomUUID(),
      routeId: id,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng,
      alt: p.alt,
      speed: p.speed,
    }));
    this.points.set(id, savedPoints);

    const savedStops: RouteStop[] = stops.map((s) => ({
      id: crypto.randomUUID(),
      routeId: id,
      startTime: s.startTime,
      endTime: s.endTime,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
    }));
    this.stops.set(id, savedStops);

    return Promise.resolve(savedRoute);
  }

  getById(id: string): Promise<Route | null> {
    return Promise.resolve(this.routes.get(id) ?? null);
  }

  getAll(): Promise<Route[]> {
    return Promise.resolve(
      Array.from(this.routes.values()).sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        if (aTime !== bTime) return bTime - aTime;
        // Mismo timestamp → usar orden de inserción (más reciente = último insertado)
        return (this.orderMap.get(b.id) ?? 0) - (this.orderMap.get(a.id) ?? 0);
      }),
    );
  }

  getPointsByRouteId(routeId: string): Promise<RoutePoint[]> {
    return Promise.resolve(this.points.get(routeId) ?? []);
  }

  getStopsByRouteId(routeId: string): Promise<RouteStop[]> {
    return Promise.resolve(this.stops.get(routeId) ?? []);
  }

  delete(id: string): Promise<void> {
    this.routes.delete(id);
    this.points.delete(id);
    this.stops.delete(id);
    return Promise.resolve();
  }
}