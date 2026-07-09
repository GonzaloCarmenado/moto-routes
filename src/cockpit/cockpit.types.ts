/**
 * Tipos del dominio Cockpit (Grabación de Rutas)
 */

export type RecordingStatus = 'idle' | 'recording' | 'paused';

export type StopDetectionState = 'moving' | 'possible-stop' | 'confirmed-stop';

export interface RoutePoint {
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

export interface Stop {
  startTime: number;
  endTime?: number;
  lat: number;
  lng: number;
  type: 'manual' | 'auto';
}

export interface RouteMetadata {
  date: string;
  duration: number;
  totalDistance: number;
  avgSpeed: number;
  stops: Stop[];
}

export interface CockpitState {
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
  invisibleMode: boolean;
}