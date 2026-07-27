export interface TimelineStop {
  /** epoch ms — punto donde la velocidad cae por primera vez (AC-006) */
  startTime: number;
  /** epoch ms — punto donde vuelve a superar el umbral, o el último punto de la ruta (AC-007) */
  endTime: number;
  lat: number;
  lng: number;
}

export interface TimelineSegment {
  startTime: number;
  endTime: number;
  avgSpeedKmh: number;
}

export type TimelineDelimiterKind = 'salida' | 'parada' | 'llegada';

export interface TimelineDelimiter {
  kind: TimelineDelimiterKind;
  startTime: number;
  /** == startTime para salida/llegada; distinto para parada */
  endTime: number;
  lat: number;
  lng: number;
}

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

/** Versión mínima de photo para la timeline (solo lo que necesita la transformación) */
export interface TimelinePhotoInput {
  id: string;
  capturedAt: string; // ISO string
}