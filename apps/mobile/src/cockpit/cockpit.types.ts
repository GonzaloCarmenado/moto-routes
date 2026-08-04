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
  /** Id del catálogo de tipos de parada — siempre presente en una parada manual (el modal es obligatorio para marcarla). */
  stopCategoryId: number;
}

/** Parada manual marcada en vivo durante la grabación, pendiente de persistir al guardar la ruta. */
export interface ManualStopEntry {
  timestamp: number;
  lat: number;
  lng: number;
  stopCategoryId: number;
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
  /** Paradas manuales marcadas en esta grabación, pendientes de persistir al guardar. */
  manualStops: ManualStopEntry[];
  hasGpsPermission: boolean;
  gpsSignalLost: boolean;
  gpsLostTimer: number;
}