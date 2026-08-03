import type { Route, RoutePoint, RouteStop, CreateRoute, CreateRoutePoint, CreateRouteStop } from './route.types.js';

/**
 * Interfaz del repositorio de rutas.
 * Contrato puro — las implementaciones concretas (SQLite, Supabase, memoria)
 * deben cumplir estos métodos sin exponer su infraestructura interna.
 */
export interface IRouteRepository {
  /** Persiste (inserta o actualiza) una ruta con sus puntos y paradas — upsert por `id`. */
  save(
    route: CreateRoute,
    points: CreateRoutePoint[],
    stops: CreateRouteStop[],
  ): Promise<Route>;

  /** Recupera una ruta por id — `null` si no existe. */
  getById(id: string): Promise<Route | null>;

  /** Lista todas las rutas (sin puntos/paradas). */
  getAll(): Promise<Route[]>;

  /** Lista los puntos GPS de una ruta en orden cronológico. */
  getPointsByRouteId(routeId: string): Promise<RoutePoint[]>;

  /** Lista las paradas detectadas de una ruta. */
  getStopsByRouteId(routeId: string): Promise<RouteStop[]>;

  /** Elimina una ruta y sus datos asociados (cascade SQL + limpieza explícita). */
  delete(id: string): Promise<void>;

  /** Persiste el trazado simplificado de una ruta de forma independiente del resto de campos. */
  updatePreviewPolyline(routeId: string, polyline: [number, number][]): Promise<void>;

  /** Persiste las notas de una ruta de forma independiente del resto de campos. `null` borra la nota existente. */
  updateNotes(routeId: string, notes: string | null): Promise<void>;
}