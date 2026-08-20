import { fetchJson, ExternalApiError } from './external-api.service.js';
import type { Route, RoutePoint, RouteStop } from '../models/route.types.js';

/**
 * Causa de un fallo al llamar a los endpoints de `/api/routes`. Mapeado desde
 * el status HTTP de la respuesta, mismo criterio que `AuthApiErrorKind`.
 */
export type RouteCloudApiErrorKind = 'unauthorized' | 'too-many-points' | 'not-found' | 'network' | 'unknown';

/** Error tipado para fallos de los endpoints de rutas en la nube. */
export class RouteCloudApiError extends Error {
  constructor(
    public readonly kind: RouteCloudApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RouteCloudApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function toRouteCloudApiError(err: unknown): RouteCloudApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new RouteCloudApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new RouteCloudApiError('network', err.message);
    }
  }
  return new RouteCloudApiError('unknown', err instanceof Error ? err.message : String(err));
}

function mapStatus(status: number): RouteCloudApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 400) return 'too-many-points';
  if (status === 404) return 'not-found';
  return 'unknown';
}

/** Resumen de ruta devuelto por `GET /api/routes` (sin puntos ni paradas). */
export interface CloudRouteSummary {
  id: string;
  createdAt: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  status: string;
  name: string | null;
  notes: string | null;
  isFavorite: boolean;
}

/** Punto GPS de una ruta de la nube, tal como lo devuelve el servidor. */
export interface CloudRoutePoint {
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

/** Parada de una ruta de la nube, tal como la devuelve el servidor. */
export interface CloudRouteStop {
  startTime: number;
  endTime: number | null;
  lat: number;
  lng: number;
  type: string;
  stopCategoryId: number | null;
}

/** Ruta completa de la nube: resumen + puntos + paradas. */
export interface CloudRouteDetail extends CloudRouteSummary {
  points: CloudRoutePoint[];
  stops: CloudRouteStop[];
}

interface CloudRouteSummaryResponse {
  id: string;
  created_at: string;
  duration: number;
  total_distance: number;
  avg_speed: number;
  status: string;
  name: string | null;
  notes: string | null;
  is_favorite: boolean;
}

interface CloudRouteDetailResponse extends CloudRouteSummaryResponse {
  points: { timestamp: number; lat: number; lng: number; alt: number; speed: number }[];
  stops: { start_time: number; end_time: number | null; lat: number; lng: number; type: string; stop_category_id: number | null }[];
}

function toCloudRouteSummary(r: CloudRouteSummaryResponse): CloudRouteSummary {
  return {
    id: r.id,
    createdAt: r.created_at,
    duration: r.duration,
    totalDistance: r.total_distance,
    avgSpeed: r.avg_speed,
    status: r.status,
    name: r.name,
    notes: r.notes,
    isFavorite: r.is_favorite,
  };
}

/** Ruta local completa a subir: metadatos + puntos + paradas. */
export interface UploadRoutePayload {
  route: Route;
  points: RoutePoint[];
  stops: RouteStop[];
}

/** Punto resultante de una subida, ya resuelto: `lat`/`lng` son la posición
 * final (ajustada a carretera si el servidor la normalizó, cruda si no) — ver
 * design.md de actualizar-mapa-tras-normalizacion, Decisión 1. */
export interface UploadedRoutePoint {
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

interface UpsertRouteResponse {
  id: string;
  points: { timestamp: number; lat: number; lng: number; alt: number; speed: number; matched_lat?: number; matched_lng?: number }[];
}

/**
 * `POST /api/routes` — sube (o actualiza, upsert por id) una ruta local
 * completa a la cuenta del usuario autenticado. Devuelve los puntos
 * resultantes que el servidor guardó, con la posición ya resuelta (ajustada
 * a carretera cuando el map-matching la tocó) para que el llamador pueda
 * repintar el mapa sin una segunda petición.
 */
export async function uploadRoute(apiBaseUrl: string, token: string, payload: UploadRoutePayload): Promise<UploadedRoutePoint[]> {
  const { route, points, stops } = payload;
  try {
    const response = await fetchJson<UpsertRouteResponse>(`${apiBaseUrl}/api/routes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
      body: {
        id: route.id,
        created_at: route.createdAt,
        duration: route.duration,
        total_distance: route.totalDistance,
        avg_speed: route.avgSpeed,
        status: route.status,
        name: route.name,
        notes: route.notes,
        is_favorite: route.isFavorite,
        points: points.map((p) => ({ timestamp: p.timestamp, lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })),
        stops: stops.map((s) => ({
          start_time: s.startTime,
          end_time: s.endTime,
          lat: s.lat,
          lng: s.lng,
          type: s.type,
          stop_category_id: s.stopCategoryId,
        })),
      },
    });
    return response.points.map((p) => ({
      timestamp: p.timestamp,
      lat: p.matched_lat ?? p.lat,
      lng: p.matched_lng ?? p.lng,
      alt: p.alt,
      speed: p.speed,
    }));
  } catch (err) {
    throw toRouteCloudApiError(err);
  }
}

/** `GET /api/routes` — resúmenes de las rutas del usuario autenticado. */
export async function fetchCloudRoutes(apiBaseUrl: string, token: string): Promise<CloudRouteSummary[]> {
  try {
    const response = await fetchJson<CloudRouteSummaryResponse[]>(`${apiBaseUrl}/api/routes`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map(toCloudRouteSummary);
  } catch (err) {
    throw toRouteCloudApiError(err);
  }
}

/**
 * `GET /api/routes/{id}/export.gpx` — descarga el GPX de una ruta del
 * usuario autenticado (puntos ajustados a carretera si ya se normalizó,
 * crudos si no). No usa `fetchJson`: la respuesta es XML, no JSON.
 */
export async function exportRouteGPX(apiBaseUrl: string, token: string, id: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/routes/${id}/export.gpx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new RouteCloudApiError('network', `Network error exporting route ${id}: ${String(err)}`);
  }

  if (!response.ok) {
    let message = `GPX export failed with status ${String(response.status)}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error) message = body.error;
    } catch {
      // cuerpo de error no-JSON o vacío — se mantiene el mensaje genérico
    }
    // mapStatus no aplica aquí: su 400 -> "too-many-points" es específico del
    // upsert. En la exportación un 400 significa "sin puntos GPS que exportar"
    // (ver specs/exportacion-gpx/spec.md) — el mensaje del servidor ya lo explica.
    const kind = response.status === 401 ? 'unauthorized' : response.status === 404 ? 'not-found' : 'unknown';
    throw new RouteCloudApiError(kind, message);
  }

  return response.blob();
}

/** `GET /api/routes/{id}` — detalle completo (puntos+paradas) de una ruta del usuario autenticado. */
export async function fetchCloudRouteDetail(apiBaseUrl: string, token: string, id: string): Promise<CloudRouteDetail> {
  try {
    const response = await fetchJson<CloudRouteDetailResponse>(`${apiBaseUrl}/api/routes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return {
      ...toCloudRouteSummary(response),
      points: response.points.map((p) => ({ timestamp: p.timestamp, lat: p.lat, lng: p.lng, alt: p.alt, speed: p.speed })),
      stops: response.stops.map((s) => ({
        startTime: s.start_time,
        endTime: s.end_time,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        stopCategoryId: s.stop_category_id,
      })),
    };
  } catch (err) {
    throw toRouteCloudApiError(err);
  }
}
