import type { Route, RoutePoint, RouteStop, CreateRoute, CreateRoutePoint, CreateRouteStop } from './route.types.js';

/**
 * Interfaz del repositorio de rutas.
 * Contrato puro — las implementaciones concretas (SQLite, Supabase, memoria)
 * deben cumplir estos métodos sin exponer su infraestructura interna.
 */
export interface IRouteRepository {
  save(
    route: CreateRoute,
    points: CreateRoutePoint[],
    stops: CreateRouteStop[],
  ): Promise<Route>;

  getById(id: string): Promise<Route | null>;

  getAll(): Promise<Route[]>;

  getPointsByRouteId(routeId: string): Promise<RoutePoint[]>;

  getStopsByRouteId(routeId: string): Promise<RouteStop[]>;

  delete(id: string): Promise<void>;
}