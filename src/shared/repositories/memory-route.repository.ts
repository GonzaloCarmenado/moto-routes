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
    const id = route.id ?? crypto.randomUUID();
    // Upsert por id: la grabación inserta una fila 'active' nada más empezar (para que
    // las fotos capturadas en pleno directo tengan una ruta padre a la que referenciar)
    // y la actualiza al parar, en vez de duplicarla.
    const existing = this.routes.get(id);
    const createdAt = existing?.createdAt ?? new Date().toISOString();

    // Preservar previewPolyline/notes de la ruta existente: route (CreateRoute) nunca los
    // trae, así que sin esto un save() posterior (ej. active -> completed) los borraría en
    // silencio, repitiendo la clase de bug de ADR-020/ADR-023. name sí puede venir en el
    // CreateRoute (se decide en el mismo save() final) — se coalesce con el existente para
    // no perderlo si una llamada futura lo omitiera.
    const savedRoute: Route = {
      ...route,
      id,
      createdAt,
      previewPolyline: existing?.previewPolyline ?? null,
      name: route.name ?? existing?.name ?? null,
      notes: existing?.notes ?? null,
    };
    this.routes.set(id, savedRoute);
    if (!existing) this.orderMap.set(id, this.insertOrder++);

    if (points.length > 0) {
      const savedPoints: RoutePoint[] = points.map((p) => ({
        id: crypto.randomUUID(),
        routeId: id,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng,
        alt: p.alt,
        speed: p.speed,
      }));
      this.points.set(id, [...(this.points.get(id) ?? []), ...savedPoints]);
    }

    if (stops.length > 0) {
      const savedStops: RouteStop[] = stops.map((s) => ({
        id: crypto.randomUUID(),
        routeId: id,
        startTime: s.startTime,
        endTime: s.endTime,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
      }));
      this.stops.set(id, [...(this.stops.get(id) ?? []), ...savedStops]);
    }

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

  updatePreviewPolyline(routeId: string, polyline: [number, number][]): Promise<void> {
    const existing = this.routes.get(routeId);
    if (existing) {
      this.routes.set(routeId, { ...existing, previewPolyline: polyline });
    }
    return Promise.resolve();
  }

  updateNotes(routeId: string, notes: string | null): Promise<void> {
    const existing = this.routes.get(routeId);
    if (existing) {
      this.routes.set(routeId, { ...existing, notes });
    }
    return Promise.resolve();
  }
}