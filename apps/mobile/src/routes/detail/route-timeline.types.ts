/** Parada detectada dentro de la ruta para la timeline (inicio, fin, ubicación). */
export interface TimelineStop {
  /** epoch ms — punto donde la velocidad cae por primera vez (AC-006) */
  startTime: number;
  /** epoch ms — punto donde vuelve a superar el umbral, o el último punto de la ruta (AC-007) */
  endTime: number;
  lat: number;
  lng: number;
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
  startTime: number;
  /** == startTime para salida/llegada; distinto para parada */
  endTime: number;
  lat: number;
  lng: number;
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