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

/** GpsProvider basado en la Geolocation API del navegador (usable tanto en web como en el WebView de Tauri). */
export function createBrowserGpsProvider(): GpsProvider {
  return {
    getCurrentPosition: () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }),
    watchPosition: (callback) => {
      const id = navigator.geolocation.watchPosition(callback, () => { /* GPS error silently ignored */ });
      return (): void => { navigator.geolocation.clearWatch(id); };
    },
    checkPermissions: (): Promise<boolean> => {
      return Promise.resolve(navigator.geolocation !== null);
    },
    requestPermissions: (): Promise<boolean> => {
      if (!navigator.geolocation) return Promise.resolve(false);
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => { resolve(true); },
          () => { resolve(false); },
        );
      });
    },
  };
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
    routeId: crypto.randomUUID(),
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
    id: s.routeId,
    duration: s.elapsedTime,
    totalDistance: s.totalDistance,
    avgSpeed: s.avgSpeed,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
  };
}

/** Fila mínima para la ruta activa, insertada nada más empezar a grabar. */
function buildActiveRoute(s: CockpitState): CreateRoute {
  return {
    id: s.routeId,
    duration: 0,
    totalDistance: 0,
    avgSpeed: 0,
    status: 'active',
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

function persistRouteOnStop(repository: IRouteRepository | undefined, state: CockpitState): void {
  if (!repository) return;
  const route = buildCreateRoute(state);
  const points = buildCreatePoints(state);
  const stops = buildStops(state);
  repository.save(route, points, stops).catch(() => {
    // Si falla, guardar backup en localStorage
    persistFallback(JSON.stringify({ route, points, stops }));
  });
}

/**
 * Inserta la fila de la ruta en cuanto empieza la grabación (estado 'active', sin
 * puntos todavía). Necesario porque la tabla `photos` tiene FOREIGN KEY (route_id)
 * REFERENCES routes(id): una foto capturada en pleno directo se guarda con el mismo
 * routeId pre-generado (ver CockpitState.routeId), y sin esta fila previa el INSERT
 * de la foto viola la clave foránea. `save()` hace upsert por id, así que el guardado
 * final en persistRouteOnStop() actualiza esta misma fila en vez de duplicarla.
 */
function persistRouteOnStart(repository: IRouteRepository | undefined, state: CockpitState): void {
  if (!repository) return;
  repository.save(buildActiveRoute(state), [], []).catch(() => {
    // Si falla, no bloqueamos la grabación: persistRouteOnStop() reintentará
    // el guardado completo (INSERT, ya que esta fila nunca llegó a crearse).
  });
}

/** Estado mutable compartido por las funciones del servicio (evita closures anidados). */
interface ServiceStore {
  state: CockpitState;
  listeners: Set<StateListener>;
  lastPoint: RoutePoint | null;
}

function notify(store: ServiceStore): void {
  const snapshot = { ...store.state };
  for (const fn of store.listeners) {
    fn(snapshot);
  }
}

function subscribeAction(store: ServiceStore, listener: StateListener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

async function requestGpsPermissionAction(store: ServiceStore, gps: GpsProvider): Promise<boolean> {
  const ok = await gps.requestPermissions();
  store.state = { ...store.state, hasGpsPermission: ok };
  notify(store);
  return ok;
}

async function checkGpsPermissionAction(store: ServiceStore, gps: GpsProvider): Promise<boolean> {
  const ok = await gps.checkPermissions();
  store.state = { ...store.state, hasGpsPermission: ok };
  notify(store);
  return ok;
}

function addPoint(store: ServiceStore, point: RoutePoint): void {
  let distanceDelta = 0;
  if (store.lastPoint) {
    distanceDelta = calculateDistance(store.lastPoint, point);
  }
  store.lastPoint = point;

  const totalDistance = store.state.totalDistance + distanceDelta;
  const avgSpeed = calculateAvgSpeed(totalDistance, store.state.elapsedTime || 1);
  const stopResult = detectStop(point.speed, store.state.stopTimer, store.state.stopState);

  store.state = {
    ...store.state,
    points: [...store.state.points, point],
    currentSpeed: point.speed,
    avgSpeed,
    totalDistance,
    altitude: point.alt,
    gpsSignalLost: false,
    gpsLostTimer: 0,
    stopState: stopResult.state,
    stopTimer: stopResult.timer,
  };
  notify(store);
}

/** Controla el intervalo de tick (tiempo transcurrido) y el watch de GPS por separado:
 * pausar solo detiene el tick, no el watch (comportamiento preexistente). */
interface RecordingLoop {
  startTick(onTick: () => void): void;
  stopTick(): void;
  startWatch(onPoint: (point: RoutePoint) => void): void;
  stopWatch(): void;
}

function createRecordingLoop(gps: GpsProvider): RecordingLoop {
  let gpsTickInterval: ReturnType<typeof setInterval> | null = null;
  let cleanupWatch: (() => void) | null = null;

  return {
    startTick(onTick: () => void): void {
      gpsTickInterval = setInterval(onTick, 1000);
    },
    stopTick(): void {
      if (gpsTickInterval != null) {
        clearInterval(gpsTickInterval);
        gpsTickInterval = null;
      }
    },
    startWatch(onPoint: (point: RoutePoint) => void): void {
      cleanupWatch = gps.watchPosition((pos) => {
        const speed = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0;
        onPoint({
          timestamp: pos.timestamp,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude ?? 0,
          speed,
        });
      });
    },
    stopWatch(): void {
      if (cleanupWatch != null) {
        cleanupWatch();
        cleanupWatch = null;
      }
    },
  };
}

function startRecordingAction(store: ServiceStore, loop: RecordingLoop, repository: IRouteRepository | undefined): void {
  if (store.state.status !== 'idle') return;
  store.state = {
    ...store.state, status: 'recording', points: [], currentSpeed: 0, avgSpeed: 0,
    totalDistance: 0, elapsedTime: 0, altitude: 0, stopState: 'moving', stopTimer: 0,
    gpsSignalLost: false, gpsLostTimer: 0,
  };
  store.lastPoint = null;
  notify(store);
  persistRouteOnStart(repository, store.state);
  loop.startTick(() => {
    store.state = { ...store.state, elapsedTime: store.state.elapsedTime + 1 };
    notify(store);
  });
  loop.startWatch((point) => { addPoint(store, point); });
}

function stopRecordingAction(store: ServiceStore, loop: RecordingLoop, repository: IRouteRepository | undefined): RouteMetadata | null {
  if (store.state.status === 'idle') return null;
  loop.stopTick();
  loop.stopWatch();
  const metadata = buildMetadata(store.state);
  persistRouteOnStop(repository, store.state);
  store.state = { ...createInitialState(), hasGpsPermission: store.state.hasGpsPermission };
  notify(store);
  return metadata;
}

function pauseRecordingAction(store: ServiceStore, loop: RecordingLoop): void {
  if (store.state.status !== 'recording') return;
  store.state = { ...store.state, status: 'paused' };
  loop.stopTick();
  notify(store);
}

function resumeRecordingAction(store: ServiceStore, loop: RecordingLoop): void {
  if (store.state.status !== 'paused') return;
  store.state = { ...store.state, status: 'recording' };
  loop.startTick(() => {
    store.state = { ...store.state, elapsedTime: store.state.elapsedTime + 1 };
    notify(store);
  });
  loop.startWatch((point) => { addPoint(store, point); });
  notify(store);
}

export function createCockpitService(
  gps: GpsProvider,
  _storage: StorageProvider,
  repository?: IRouteRepository,
): CockpitService {
  const store: ServiceStore = { state: createInitialState(), listeners: new Set(), lastPoint: null };
  const loop = createRecordingLoop(gps);

  return {
    subscribe: (listener): (() => void) => subscribeAction(store, listener),
    getCurrentState: (): CockpitState => ({ ...store.state }),
    startRecording: (): void => { startRecordingAction(store, loop, repository); },
    stopRecording: (): RouteMetadata | null => stopRecordingAction(store, loop, repository),
    pauseRecording: (): void => { pauseRecordingAction(store, loop); },
    resumeRecording: (): void => { resumeRecordingAction(store, loop); },
    checkGpsPermission: (): Promise<boolean> => checkGpsPermissionAction(store, gps),
    requestGpsPermission: (): Promise<boolean> => requestGpsPermissionAction(store, gps),
    setInvisibleMode: (active: boolean): void => {
      store.state = { ...store.state, invisibleMode: active };
      notify(store);
    },
  };
}
