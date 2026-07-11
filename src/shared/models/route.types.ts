/**
 * Modelos de dominio para persistencia de rutas.
 * Entidades puras — sin dependencias de DOM, Tauri, React ni ningún framework.
 * Tipado estricto: propiedades con tipo explícito, readonly en inmutables.
 */

/* ------------------------------------------------------------------ */
/*  Enums / Union types                                               */
/* ------------------------------------------------------------------ */

export type RouteStatus = 'active' | 'completed' | 'archived';
export type RouteVisibility = 'private' | 'public';
export type RouteOrigin = 'local' | 'remote';
export type StopType = 'manual' | 'auto';

/* ------------------------------------------------------------------ */
/*  Entidades (lectura)                                               */
/* ------------------------------------------------------------------ */

export interface Route {
  readonly id: string;
  readonly createdAt: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  status: RouteStatus;
  visibility: RouteVisibility;
  origin: RouteOrigin;
}

export interface RoutePoint {
  readonly id: string;
  readonly routeId: string;
  readonly timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

export interface RouteStop {
  readonly id: string;
  readonly routeId: string;
  readonly startTime: number;
  endTime: number | null;
  lat: number;
  lng: number;
  type: StopType;
}

/* ------------------------------------------------------------------ */
/*  Tipos de creación (escritura — sin id ni createdAt)                */
/* ------------------------------------------------------------------ */

export interface CreateRoute {
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  status: RouteStatus;
  visibility: RouteVisibility;
  origin: RouteOrigin;
}

export interface CreateRoutePoint {
  routeId: string;
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

export interface CreateRouteStop {
  routeId: string;
  startTime: number;
  endTime: number | null;
  lat: number;
  lng: number;
  type: StopType;
}