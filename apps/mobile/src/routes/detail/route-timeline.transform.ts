import type { RoutePoint } from '../../shared/models/route.types.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';
import type { TimelineStopInput, TimelinePhotoInput, TimelineData, TimelineDelimiter, TimelineRow, TimelineSegment } from './route-timeline.types.js';
import { calculateDistance } from '../../shared/utils/geo.js';
import { calculateAvgSpeed as cockpitAvgSpeed } from '../../shared/utils/format.js';

/* ------------------------------------------------------------------ */
/*  Paso 2: buildStopDelimiters — paradas reales con categoría (6.1/6.3/6.4) */
/* ------------------------------------------------------------------ */

/**
 * Convierte paradas reales (`route_stops`) en delimitadores de timeline.
 * Una parada sin categoría resuelta en el catálogo se descarta por completo
 * (AC-6.4: nunca aparece un delimitador de parada sin tipo) — hoy no ocurre
 * en la práctica porque solo se persisten paradas manuales con tipo
 * obligatorio, pero se mantiene la comprobación por si el catálogo local
 * está desactualizado respecto al id guardado.
 */
export function buildStopDelimiters(
  stops: TimelineStopInput[],
  categoriesById: Map<number, StopCategory>,
): TimelineDelimiter[] {
  return stops
    .filter((s): s is TimelineStopInput & { stopCategoryId: number } => s.stopCategoryId !== null && categoriesById.has(s.stopCategoryId))
    .map((s) => {
      const category = categoriesById.get(s.stopCategoryId)!;
      return {
        kind: 'parada' as const,
        startTime: s.startTime,
        endTime: s.startTime,
        lat: s.lat,
        lng: s.lng,
        category: { icon: category.icon, label: category.label },
      };
    })
    .sort((a, b) => a.startTime - b.startTime);
}

/* ------------------------------------------------------------------ */
/*  Paso 3: Helpers de formato — AC-019, AC-020, AC-021               */
/* ------------------------------------------------------------------ */

/** Formatea un epoch ms a HH:mm en 24h (AC-019). */
export function formatTimelineTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Formatea lat/lng con exactamente 4 decimales (AC-020). */
export function formatTimelineCoords(lat: number, lng: number): string {
  const latStr = lat.toFixed(4);
  const lngStr = lng.toFixed(4);
  return latStr + ', ' + lngStr;
}

/** Formatea velocidad como entero seguido de " km/h" (AC-021). */
export function formatTimelineSpeed(kmh: number): string {
  return Math.round(kmh).toString() + ' km/h';
}

/* ------------------------------------------------------------------ */
/*  Paso 4: buildTimelineSegments — AC-011, AC-012, AC-013            */
/* ------------------------------------------------------------------ */

interface TimeWindow {
  startTime: number;
  endTime: number;
}

/**
 * Calcula la velocidad media para cada ventana temporal entre delimitadores.
 * Reutiliza calculateDistance/calculateAvgSpeed de cockpit.transform.ts.
 */
export function buildTimelineSegments(
  points: RoutePoint[],
  windows: TimeWindow[],
): TimelineSegment[] {
  return windows.map((w) => {
    const segmentPoints = points.filter((p) => p.timestamp >= w.startTime && p.timestamp <= w.endTime);

    if (segmentPoints.length < 2) {
      return { startTime: w.startTime, endTime: w.endTime, avgSpeedKmh: 0 };
    }

    let totalDistKm = 0;
    for (let i = 1; i < segmentPoints.length; i++) {
      const a = segmentPoints[i - 1]!;
      const b = segmentPoints[i]!;
      totalDistKm += calculateDistance(a, b);
    }

    const durationSeconds = (w.endTime - w.startTime) / 1000;
    const avgSpeedKmh = cockpitAvgSpeed(totalDistKm, durationSeconds);

    return { startTime: w.startTime, endTime: w.endTime, avgSpeedKmh };
  });
}

/* ------------------------------------------------------------------ */
/*  Paso 5: buildTimelineData — orquestador (AC-002/003/008/010/014-017) */
/* ------------------------------------------------------------------ */

function buildDelimiterFromPoint(kind: 'salida' | 'llegada', pt: RoutePoint): TimelineDelimiter {
  return {
    kind,
    startTime: pt.timestamp,
    endTime: pt.timestamp,
    lat: pt.lat,
    lng: pt.lng,
  };
}

function sortPointsByTimestamp(points: RoutePoint[]): RoutePoint[] {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
}

interface PhotoSortEntry {
  photoId: string;
  time: number;
}

function sortPhotosByTime(photos: TimelinePhotoInput[]): PhotoSortEntry[] {
  return [...photos]
    .map((p) => ({ photoId: p.id, time: new Date(p.capturedAt).getTime() }))
    .sort((a, b) => a.time - b.time);
}

function buildWindows(delimiters: TimelineDelimiter[]): TimeWindow[] {
  const windows: TimeWindow[] = [];
  for (let i = 0; i < delimiters.length - 1; i++) {
    const current = delimiters[i]!;
    const next = delimiters[i + 1]!;
    windows.push({ startTime: current.endTime, endTime: next.startTime });
  }
  return windows;
}

function buildRows(
  delimiters: TimelineDelimiter[],
  segments: TimelineSegment[],
  sortedPhotos: PhotoSortEntry[],
): TimelineRow[] {
  return delimiters.map((delimiter, i) => {
    const segment: TimelineSegment | null = i < segments.length ? segments[i]! : null;

    const segmentStart = delimiter.endTime;
    const segmentEnd = i < delimiters.length - 1 ? delimiters[i + 1]!.startTime : Number.POSITIVE_INFINITY;

    const photosInSegment = sortedPhotos.filter((ph) => ph.time >= segmentStart && ph.time < segmentEnd);

    return {
      delimiter,
      segment: segment !== null
        ? { startTime: segment.startTime, endTime: segment.endTime, avgSpeedKmh: segment.avgSpeedKmh }
        : null,
      photosInSegment,
    };
  });
}

/**
 * Orquestador principal: combina Salida/Llegada, paradas detectadas, fotos
 * y tramos de velocidad en una estructura TimelineData lista para renderizar.
 */
export function buildTimelineData(
  points: RoutePoint[],
  photos: TimelinePhotoInput[],
  stops: TimelineStopInput[],
  categoriesById: Map<number, StopCategory>,
): TimelineData {
  const sortedPoints = sortPointsByTimestamp(points);
  const sortedPhotos = sortPhotosByTime(photos);

  // AC-015: menos de 2 puntos GPS
  if (sortedPoints.length < 2) {
    return {
      hasGpsData: false,
      rows: [],
      photosBeforeStart: [],
      photosAfterEnd: [],
      orphanPhotos: sortedPhotos, // AC-016
    };
  }

  const firstPt = sortedPoints[0]!;
  const lastPt = sortedPoints[sortedPoints.length - 1]!;

  // AC-002: Salida, AC-003: Llegada
  const salida = buildDelimiterFromPoint('salida', firstPt);
  const llegada = buildDelimiterFromPoint('llegada', lastPt);

  // Paradas reales con categoría (AC-6.1/6.3/6.4)
  const stopDelimiters = buildStopDelimiters(stops, categoriesById);

  const allDelimiters: TimelineDelimiter[] = [salida, ...stopDelimiters, llegada];

  // Ventanas de tramo entre delimitadores
  const windows = buildWindows(allDelimiters);
  const segments = buildTimelineSegments(sortedPoints, windows);

  // Construir filas
  const rows = buildRows(allDelimiters, segments, sortedPhotos);

  // Fotos fuera del rango [Salida, Llegada]
  const photosBeforeStart = sortedPhotos.filter((ph) => ph.time < firstPt.timestamp);
  const photosAfterEnd = sortedPhotos.filter((ph) => ph.time > lastPt.timestamp);

  return {
    hasGpsData: true,
    rows,
    photosBeforeStart,
    photosAfterEnd,
    orphanPhotos: [],
  };
}