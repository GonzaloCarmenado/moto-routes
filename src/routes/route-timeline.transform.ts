import type { RoutePoint } from '../shared/models/route.types.js';
import type { TimelineStop, TimelinePhotoInput, TimelineData, TimelineDelimiter, TimelineRow, TimelineSegment } from './route-timeline.types.js';
// Excepción admitida por AC-001 (`specs/features/deuda-tecnica-auditoria.md`):
// `detectStop` sigue viviendo en `cockpit.transform.ts` porque depende de
// `StopDetectionState`, un tipo específico del dominio cockpit. No usar este
// import como precedente para otros imports cruzados `routes` → `cockpit`.
import { detectStop } from '../cockpit/cockpit.transform.js';
import { calculateDistance } from '../shared/utils/geo.js';
import { calculateAvgSpeed as cockpitAvgSpeed } from '../shared/utils/format.js';

/* ------------------------------------------------------------------ */
/*  Paso 2: detectStopsFromPoints — AC-004 a AC-007                   */
/* ------------------------------------------------------------------ */

/**
 * Detecta paradas a partir de los puntos de ruta persistidos, reutilizando
 * el mismo criterio conservador que la detección en vivo (velocidad ≤3 km/h,
 * 30 puntos de confirmación).
 */
export function detectStopsFromPoints(points: RoutePoint[]): TimelineStop[] {
  if (points.length === 0) return [];

  const stops: TimelineStop[] = [];
  let stopStartTime: number | null = null;
  let stopStartLat = 0;
  let stopStartLng = 0;
  let timer = 0;
  let state: 'moving' | 'possible-stop' | 'confirmed-stop' = 'moving';

  for (const pt of points) {
    const prevState = state;
    const result = detectStop(pt.speed, timer, state);
    state = result.state;
    timer = result.timer;

    if (state === 'possible-stop' && prevState !== 'possible-stop' && prevState !== 'confirmed-stop') {
      stopStartTime = pt.timestamp;
      stopStartLat = pt.lat;
      stopStartLng = pt.lng;
    }

    if (state === 'moving' && prevState === 'confirmed-stop') {
      stops.push({
        startTime: stopStartTime!,
        endTime: pt.timestamp,
        lat: stopStartLat,
        lng: stopStartLng,
      });
      stopStartTime = null;
    }
  }

  // AC-007: ruta termina con vehículo detenido
  if (state === 'confirmed-stop' && stopStartTime !== null && points.length > 0) {
    const lastPt = points[points.length - 1]!;
    stops.push({
      startTime: stopStartTime,
      endTime: lastPt.timestamp,
      lat: stopStartLat,
      lng: stopStartLng,
    });
  }

  return stops;
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

  // Paradas detectadas
  const stops = detectStopsFromPoints(sortedPoints);

  const stopDelimiters: TimelineDelimiter[] = stops.map((s) => ({
    kind: 'parada' as const,
    startTime: s.startTime,
    endTime: s.endTime,
    lat: s.lat,
    lng: s.lng,
  }));

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