/**
 * Modelos de dominio para persistencia de rutas.
 * Entidades puras — sin dependencias de DOM, Tauri, React ni ningún framework.
 * Tipado estricto: propiedades con tipo explícito, readonly en inmutables.
 */

/* ------------------------------------------------------------------ */
/*  Enums / Union types                                               */
/* ------------------------------------------------------------------ */

/** Estado del ciclo de vida de una ruta: en grabación (`active`), finalizada (`completed`) o archivada. */
export type RouteStatus = 'active' | 'completed' | 'archived';
/** Visibilidad de la ruta: privada (por defecto) o pública. */
export type RouteVisibility = 'private' | 'public';
/** Origen de la ruta: grabada en este dispositivo (`local`) o importada/remota. */
export type RouteOrigin = 'local' | 'remote';
/** Cómo se detectó la parada: manual (usuario) o automática (algoritmo de detección). */
export type StopType = 'manual' | 'auto';

/* ------------------------------------------------------------------ */
/*  Entidades (lectura)                                               */
/* ------------------------------------------------------------------ */

/** Ruta guardada (entidad de lectura completa). */
export interface Route {
  readonly id: string;
  readonly createdAt: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  status: RouteStatus;
  visibility: RouteVisibility;
  origin: RouteOrigin;
  /** Trazado simplificado (pares [lat, lng]), dato derivado y recalculable — null si aún no se ha calculado/persistido. */
  previewPolyline: [number, number][] | null;
  /** Nombre elegido por el usuario al guardar (o el por defecto de fecha/hora) — null en rutas guardadas antes de esta feature o aún no finalizadas. */
  name: string | null;
  /** Notas de texto libre editadas desde el detalle de ruta — null si no se ha guardado ninguna. */
  notes: string | null;
  /** Marcada como favorita por el usuario, ligada a su cuenta — false por defecto. */
  isFavorite: boolean;
}

/** Punto GPS individual de una ruta (entidad de lectura). */
export interface RoutePoint {
  readonly id: string;
  readonly routeId: string;
  readonly timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

/** Parada detectada dentro de una ruta (entidad de lectura). */
export interface RouteStop {
  readonly id: string;
  readonly routeId: string;
  readonly startTime: number;
  endTime: number | null;
  lat: number;
  lng: number;
  type: StopType;
  /** Id del catálogo de tipos de parada (bar/mirador/…) — null si la parada
   * no tiene categoría asignada (nunca ocurre en una parada manual, ver
   * cockpit-manual-stops: el modal es obligatorio para persistirla). */
  stopCategoryId: number | null;
}

/* ------------------------------------------------------------------ */
/*  Tipos de creación (escritura — sin id ni createdAt)                */
/* ------------------------------------------------------------------ */

/** Datos necesarios para crear una ruta (escritura — sin `id` ni `createdAt`). */
export interface CreateRoute {
  /** ID pre-generado (ej. asignado al iniciar grabación para poder asociar fotos capturadas
   * en pleno directo antes de que la ruta se persista). Si se omite, el repositorio genera uno. */
  id?: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  status: RouteStatus;
  visibility: RouteVisibility;
  origin: RouteOrigin;
  /** Opcional: la fila 'active' insertada al empezar a grabar aún no tiene nombre — se
   * añade en el save() final de confirmSaveRecording(). La regla de "nunca vacío" al
   * guardar de verdad se garantiza en cockpit-stop.service.ts, no en este tipo. */
  name?: string;
}

/** Datos necesarios para crear un punto GPS (escritura). */
export interface CreateRoutePoint {
  routeId: string;
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

/** Datos necesarios para crear una parada (escritura). */
export interface CreateRouteStop {
  routeId: string;
  startTime: number;
  endTime: number | null;
  lat: number;
  lng: number;
  type: StopType;
  /** Id del catálogo de tipos de parada — null para una parada sin categoría. */
  stopCategoryId: number | null;
}