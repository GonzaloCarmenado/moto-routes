/**
 * Parada real persistida (`route_stops`), reducida a lo que necesita la
 * timeline: momento y ubicación en que se marcó, y su categoría del
 * catálogo (null si no tiene tipo asignado — nunca ocurre hoy en la
 * práctica porque solo se persisten paradas manuales, con modal obligatorio,
 * pero el tipo lo modela igualmente por fidelidad con `RouteStop`).
 */
export interface TimelineStopInput {
  startTime: number;
  lat: number;
  lng: number;
  stopCategoryId: number | null;
}

/** Tramo de la ruta entre dos delimitadores de la timeline. */
export interface TimelineSegment {
  startTime: number;
  endTime: number;
  avgSpeedKmh: number;
}

/** Tipo de delimitador de la timeline: salida, parada o llegada. */
export type TimelineDelimiterKind = 'salida' | 'parada' | 'llegada';

/** Delimitador visual de la timeline (Salida, Parada o Llegada con su posición). */
export interface TimelineDelimiter {
  kind: TimelineDelimiterKind;
  /** Las paradas manuales son instantáneas (un único punto GPS al pulsar "marcar parada"): startTime === endTime siempre. */
  startTime: number;
  endTime: number;
  lat: number;
  lng: number;
  /** Solo presente en kind 'parada' con categoría resuelta del catálogo (AC-6.3). `key` resuelve el icono SVG (ver shared/icons/stop-type-icons.ts), nunca se renderiza el emoji del catálogo directamente. */
  category?: { key: string; label: string };
}

/** Marcador de foto en la timeline (id y momento de captura). */
export interface TimelinePhotoMarker {
  photoId: string;
  /** capturedAt en epoch ms */
  time: number;
}

/**
 * Fila de renderizado: un delimitador, opcionalmente seguido del tramo hasta
 * el siguiente delimitador (null tras la Llegada, el último). Las fotos que
 * caen dentro de ese tramo cronológicamente van en `photosInSegment`.
 */
export interface TimelineRow {
  delimiter: TimelineDelimiter;
  segment: TimelineSegment | null;
  photosInSegment: TimelinePhotoMarker[];
}

/** Datos completos de la timeline: filas, fotos por tramo y fotos huérfanas. */
export interface TimelineData {
  /** false si <2 route_points (AC-015) */
  hasGpsData: boolean;
  /** vacío si !hasGpsData */
  rows: TimelineRow[];
  /** Fotos con capturedAt fuera de [Salida, Llegada] — se muestran igual */
  photosBeforeStart: TimelinePhotoMarker[];
  photosAfterEnd: TimelinePhotoMarker[];
  /** Fotos cuando !hasGpsData (AC-016) */
  orphanPhotos: TimelinePhotoMarker[];
}

/** Versión mínima de foto para la timeline (solo lo que necesita la transformación). */
export interface TimelinePhotoInput {
  id: string;
  capturedAt: string; // ISO string
}