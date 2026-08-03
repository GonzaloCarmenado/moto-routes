/**
 * Tipos del dominio Cockpit (Grabación de Rutas)
 */

/** Estado del ciclo de grabación: parado, grabando o pausado. */
export type RecordingStatus = 'idle' | 'recording' | 'paused';

/** Estado de la detección de paradas: en movimiento, posible parada o confirmada. */
export type StopDetectionState = 'moving' | 'possible-stop' | 'confirmed-stop';

/** Punto GPS de una grabación activa (sin id — se genera al persistir). */
export interface RoutePoint {
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

/** Parada detectada dentro de una grabación (tiempos y ubicación). */
export interface Stop {
  startTime: number;
  endTime?: number;
  lat: number;
  lng: number;
  type: 'manual' | 'auto';
}

/** Metadatos de una ruta al detener la grabación (para el diálogo guardar/descartar). */
export interface RouteMetadata {
  date: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  stops: Stop[];
}

/** Estado completo del cockpit en un instante (snapshot inmutable compartido con listeners). */
export interface CockpitState {
  /** ID pre-generado de la ruta en curso, asignado al iniciar la grabación.
   * Permite asociar fotos capturadas durante la grabación a la ruta antes
   * de que esta se persista al finalizar (stopRecording). */
  routeId: string;
  status: RecordingStatus;
  currentSpeed: number;
  avgSpeed: number;
  totalDistance: number;
  elapsedTime: number;
  altitude: number;
  points: RoutePoint[];
  stopState: StopDetectionState;
  stopTimer: number;
  hasGpsPermission: boolean;
  gpsSignalLost: boolean;
  gpsLostTimer: number;
}