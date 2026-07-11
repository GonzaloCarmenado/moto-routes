/**
 * Servicio de grabación de rutas GPS.
 * Maneja el estado de grabación, acumulación de puntos, persistencia y lógica de paradas.
 * No depende del DOM ni de Web Components. Es inyectable con un mock de GPS.
 */

import type { CockpitState, RoutePoint, RouteMetadata } from './cockpit.types.js';
import { calculateDistance, calculateAvgSpeed, detectStop } from './cockpit.transform.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { CreateRoute, CreateRoutePoint, CreateRouteStop } from '../shared/models/route.types.js';

export interface GpsProvider {
  getCurrentPosition(): Promise<GeolocationPosition>;
  watchPosition(callback: (pos: GeolocationPosition) => void): () => void;
  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
}

export interface StorageProvider {
  save(path: string, data: string): Promise<void>;
}

export type StateListener = (state: CockpitState) => void;

export interface CockpitService {
  subscribe(listener: StateListener): () => void;
  getCurrentState(): CockpitState;
  startRecording(): void;
  stopRecording(): RouteMetadata | null;
  pauseRecording(): void;
  resumeRecording(): void;
  checkGpsPermission(): Promise<boolean>;
  requestGpsPermission(): Promise<boolean>;
  setInvisibleMode(active: boolean): void;
}

const BACKUP_KEY = 'moto-routes-pending-backup';

function createInitialState(): CockpitState {
  return {
    status: 'idle',
    currentSpeed: 0,
    avgSpeed: 0,
    totalDistance: 0,
    elapsedTime: 0,
    altitude: 0,
    points: [],
    stopState: 'moving',
    stopTimer: 0,
    hasGpsPermission: false,
    gpsSignalLost: false,
    gpsLostTimer: 0,
    invisibleMode: false,
  };
}

function buildMetadata(s: CockpitState): RouteMetadata {
  return {
    date: new Date().toISOString(),
    duration: s.elapsedTime,
    totalDistance: s.totalDistance,
    avgSpeed: s.avgSpeed,
    stops: [],
  };
}

function buildCreateRoute(s: CockpitState): CreateRoute {
  return {
    duration: s.elapsedTime,
    totalDistance: s.totalDistance,
    avgSpeed: s.avgSpeed,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
  };
}

function buildCreatePoints(s: CockpitState): CreateRoutePoint[] {
  return s.points.map((p) => ({
    routeId: '', // será asignado por el repositorio
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    speed: p.speed,
  }));
}

function buildStops(_s: CockpitState): CreateRouteStop[] {
  // Por ahora sin detección de paradas implementada
  return [];
}

function persistFallback(data: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, data);
  } catch {
    // localStorage lleno o no disponible — silencioso
  }
}

export function createCockpitService(
  gps: GpsProvider,
  _storage: StorageProvider,
  repository?: IRouteRepository,
): CockpitService {
  let state: CockpitState = createInitialState();
  const listeners = new Set<StateListener>();
  let cleanupWatch: (() => void) | null = null;
  let gpsTickInterval: ReturnType<typeof setInterval> | null = null;
  let lastPoint: RoutePoint | null = null;

  function notify(): void {
    const snapshot = { ...state };
    for (const fn of listeners) {
      fn(snapshot);
    }
  }

  function subscribe(listener: StateListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  async function requestGpsPermission(): Promise<boolean> {
    const ok = await gps.requestPermissions();
    state = { ...state, hasGpsPermission: ok };
    notify();
    return ok;
  }

  async function checkGpsPermission(): Promise<boolean> {
    const ok = await gps.checkPermissions();
    state = { ...state, hasGpsPermission: ok };
    notify();
    return ok;
  }

  function addPoint(point: RoutePoint): void {
    let distanceDelta = 0;
    if (lastPoint) {
      distanceDelta = calculateDistance(lastPoint, point);
    }
    lastPoint = point;

    const totalDistance = state.totalDistance + distanceDelta;
    const avgSpeed = calculateAvgSpeed(totalDistance, state.elapsedTime || 1);
    const stopResult = detectStop(point.speed, state.stopTimer, state.stopState);

    state = {
      ...state,
      points: [...state.points, point],
      currentSpeed: point.speed,
      avgSpeed,
      totalDistance,
      altitude: point.alt,
      gpsSignalLost: false,
      gpsLostTimer: 0,
      stopState: stopResult.state,
      stopTimer: stopResult.timer,
    };
    notify();
  }

  function startTick(): void {
    gpsTickInterval = setInterval(() => {
      state = { ...state, elapsedTime: state.elapsedTime + 1 };
      notify();
    }, 1000);
  }

  function startWatch(): void {
    cleanupWatch = gps.watchPosition((pos) => {
      const speed = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0;
      const point: RoutePoint = {
        timestamp: pos.timestamp,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        alt: pos.coords.altitude ?? 0,
        speed,
      };
      addPoint(point);
    });
  }

  function cleanup(): void {
    if (gpsTickInterval != null) {
      clearInterval(gpsTickInterval);
      gpsTickInterval = null;
    }
    if (cleanupWatch != null) {
      cleanupWatch();
      cleanupWatch = null;
    }
  }

  return {
    subscribe,
    getCurrentState: (): CockpitState => ({ ...state }),
    startRecording: (): void => {
      if (state.status !== 'idle') return;
      state = { ...state, status: 'recording', points: [], currentSpeed: 0, avgSpeed: 0,
        totalDistance: 0, elapsedTime: 0, altitude: 0, stopState: 'moving', stopTimer: 0,
        gpsSignalLost: false, gpsLostTimer: 0 };
      lastPoint = null;
      notify();
      startTick();
      startWatch();
    },
    stopRecording: (): RouteMetadata | null => {
      if (state.status === 'idle') return null;
      cleanup();
      const metadata = buildMetadata(state);

      // Persistir si hay repositorio
      if (repository) {
        const route = buildCreateRoute(state);
        const points = buildCreatePoints(state);
        const stops = buildStops(state);
        repository.save(route, points, stops).catch(() => {
          // Si falla, guardar backup en localStorage
          persistFallback(JSON.stringify({ route, points, stops }));
        });
      }

      state = { ...createInitialState(), hasGpsPermission: state.hasGpsPermission };
      notify();
      return metadata;
    },
    pauseRecording: (): void => {
      if (state.status !== 'recording') return;
      state = { ...state, status: 'paused' };
      if (gpsTickInterval != null) clearInterval(gpsTickInterval);
      gpsTickInterval = null;
      notify();
    },
    resumeRecording: (): void => {
      if (state.status !== 'paused') return;
      state = { ...state, status: 'recording' };
      startTick();
      startWatch();
      notify();
    },
    checkGpsPermission,
    requestGpsPermission,
    setInvisibleMode: (active: boolean): void => {
      state = { ...state, invisibleMode: active };
      notify();
    },
  };
}