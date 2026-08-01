/**
 * Servicio de grabación de rutas GPS.
 * Maneja el estado de grabación, acumulación de puntos, persistencia y lógica de paradas.
 * No depende del DOM ni de Web Components. Es inyectable con un mock de GPS.
 */

import type { CockpitState, RoutePoint, RouteMetadata } from './cockpit.types.js';
import { detectStop } from './cockpit.transform.js';
import { calculateDistance } from '../shared/utils/geo.js';
import { calculateAvgSpeed } from '../shared/utils/format.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { triggerForegroundService, triggerLocationPause, type ForegroundServiceProvider } from './gps/cockpit-foreground.service.js';
import { persistRouteOnStart, persistRouteOnStop } from './persist/cockpit-persist.service.js';

export type { ForegroundServiceProvider } from './gps/cockpit-foreground.service.js';

/** Proveedor de ubicación (navegador o nativo Android) con permisos. */
export interface GpsProvider {
  getCurrentPosition(): Promise<GeolocationPosition>;
  watchPosition(callback: (pos: GeolocationPosition) => void): () => void;
  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
}

/** Almacenamiento genérico (guardado de archivos, p. ej. fotos). */
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

/** Listener de cambios de estado del cockpit. */
export type StateListener = (state: CockpitState) => void;

/** API pública del servicio de grabación (creado con `createCockpitService`). */
export interface CockpitService {
  subscribe(listener: StateListener): () => void;
  getCurrentState(): CockpitState;
  startRecording(): void;
  /**
   * Detiene el tick del cronómetro y el watch de GPS (congela el estado) sin
   * persistir ni resetear todavía — el estado sigue reflejando `recording`/`paused`
   * con los datos finales, a la espera de que el llamador decida entre
   * `confirmSaveRecording()` y `discardStop()`. Devuelve `null` si ya estaba `idle`.
   */
  prepareStop(): RouteMetadata | null;
  /** Persiste el estado congelado por `prepareStop()` como 'completed' con el nombre dado, y resetea a `idle`. */
  confirmSaveRecording(name: string): void;
  /** Resetea a `idle` sin persistir. El borrado de la fila 'active' y sus fotos es responsabilidad del llamador (ver deleteRouteAndPhotos). */
  discardStop(): void;
  pauseRecording(): void;
  resumeRecording(): void;
  checkGpsPermission(): Promise<boolean>;
  requestGpsPermission(): Promise<boolean>;
}

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

/** Estado mutable compartido por las funciones del servicio (evita closures anidados). */
interface ServiceStore {
  state: CockpitState;
  listeners: Set<StateListener>;
  lastPoint: RoutePoint | null;
  /** Instante real (Date.now()) en que empezó la grabación. `null` si no hay grabación en curso.
   * `elapsedTime` se deriva de este reloj real en vez de contar ticks de `setInterval`, porque
   * Chromium puede pausar/retrasar los intervalos en segundo plano (mismo motivo por el que el
   * GPS ya usa eventos nativos, ver cockpit-native-gps.service.ts) — contar ticks hacía que el
   * cronómetro se quedara muy por detrás del tiempo real tras un rato con la pantalla bloqueada. */
  recordingStartedAt: number | null;
  /** Suma de todos los intervalos de pausa ya cerrados (ms). */
  pausedMs: number;
  /** Instante en que empezó la pausa actual, o `null` si no está pausado. */
  pausedSince: number | null;
}

/** Tiempo transcurrido real (segundos) desde el inicio de la grabación, descontando pausas.
 * Se recalcula desde el reloj de pared en cada llamada (tick o punto GPS nuevo) en vez de
 * arrastrar un contador, para que se autocorrija aunque el intervalo de 1s se haya retrasado. */
function computeElapsedSeconds(store: ServiceStore): number {
  if (store.recordingStartedAt == null) return store.state.elapsedTime;
  const pausedMs = store.pausedSince != null ? store.pausedMs + (Date.now() - store.pausedSince) : store.pausedMs;
  return Math.floor((Date.now() - store.recordingStartedAt - pausedMs) / 1000);
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
  const elapsedTime = computeElapsedSeconds(store);
  const avgSpeed = calculateAvgSpeed(totalDistance, elapsedTime || 1);
  const stopResult = detectStop(point.speed, store.state.stopTimer, store.state.stopState);

  store.state = {
    ...store.state,
    points: [...store.state.points, point],
    currentSpeed: point.speed,
    avgSpeed,
    totalDistance,
    elapsedTime,
    altitude: point.alt,
    gpsSignalLost: false,
    gpsLostTimer: 0,
    stopState: stopResult.state,
    stopTimer: stopResult.timer,
  };
  notify(store);
}

/** Controla el intervalo de tick (tiempo transcurrido) y el watch de GPS por separado.
 * Corregido en la Fase 2 (AC-022): pausar SÍ detiene también el watch (antes se dejaba
 * corriendo un watch "huérfano" que, al reanudar, se sumaba a uno nuevo y duplicaba
 * cada punto GPS recibido tras la reanudación). */
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

function startRecordingAction(
  store: ServiceStore,
  loop: RecordingLoop,
  repository: IRouteRepository | undefined,
  foregroundService: ForegroundServiceProvider | undefined,
): void {
  if (store.state.status !== 'idle') return;
  store.state = {
    ...store.state, status: 'recording', points: [], currentSpeed: 0, avgSpeed: 0,
    totalDistance: 0, elapsedTime: 0, altitude: 0, stopState: 'moving', stopTimer: 0,
    gpsSignalLost: false, gpsLostTimer: 0,
  };
  store.lastPoint = null;
  store.recordingStartedAt = Date.now();
  store.pausedMs = 0;
  store.pausedSince = null;
  notify(store);
  persistRouteOnStart(repository, store.state);
  triggerForegroundService(foregroundService, true);
  loop.startTick(() => {
    store.state = { ...store.state, elapsedTime: computeElapsedSeconds(store) };
    notify(store);
  });
  loop.startWatch((point) => { addPoint(store, point); });
}

function prepareStopAction(
  store: ServiceStore,
  loop: RecordingLoop,
  foregroundService: ForegroundServiceProvider | undefined,
): RouteMetadata | null {
  if (store.state.status === 'idle') return null;
  store.state = { ...store.state, elapsedTime: computeElapsedSeconds(store) };
  loop.stopTick();
  loop.stopWatch();
  triggerForegroundService(foregroundService, false);
  return buildMetadata(store.state);
}

function confirmSaveRecordingAction(store: ServiceStore, repository: IRouteRepository | undefined, name: string): void {
  persistRouteOnStop(repository, store.state, name);
  store.state = { ...createInitialState(), hasGpsPermission: store.state.hasGpsPermission };
  store.recordingStartedAt = null;
  store.pausedMs = 0;
  store.pausedSince = null;
  notify(store);
}

function discardStopAction(store: ServiceStore): void {
  store.state = { ...createInitialState(), hasGpsPermission: store.state.hasGpsPermission };
  store.recordingStartedAt = null;
  store.pausedMs = 0;
  store.pausedSince = null;
  notify(store);
}

function pauseRecordingAction(
  store: ServiceStore,
  loop: RecordingLoop,
  foregroundService: ForegroundServiceProvider | undefined,
): void {
  if (store.state.status !== 'recording') return;
  store.state = { ...store.state, status: 'paused', elapsedTime: computeElapsedSeconds(store) };
  store.pausedSince = Date.now();
  loop.stopTick();
  loop.stopWatch();
  triggerLocationPause(foregroundService, true);
  notify(store);
}

function resumeRecordingAction(
  store: ServiceStore,
  loop: RecordingLoop,
  foregroundService: ForegroundServiceProvider | undefined,
): void {
  if (store.state.status !== 'paused') return;
  if (store.pausedSince != null) {
    store.pausedMs += Date.now() - store.pausedSince;
    store.pausedSince = null;
  }
  store.state = { ...store.state, status: 'recording' };
  triggerLocationPause(foregroundService, false);
  loop.startTick(() => {
    store.state = { ...store.state, elapsedTime: computeElapsedSeconds(store) };
    notify(store);
  });
  loop.startWatch((point) => { addPoint(store, point); });
  notify(store);
}

/** Crea el servicio de estado del cockpit con sus providers y listeners.
 * Es la única forma recomendada de instanciar `CockpitService` (el estado vive
 * en un closure interno). */
export function createCockpitService(
  gps: GpsProvider,
  _storage: StorageProvider,
  repository?: IRouteRepository,
  foregroundService?: ForegroundServiceProvider,
): CockpitService {
  const store: ServiceStore = {
    state: createInitialState(),
    listeners: new Set(),
    lastPoint: null,
    recordingStartedAt: null,
    pausedMs: 0,
    pausedSince: null,
  };
  const loop = createRecordingLoop(gps);

  return {
    subscribe: (listener): (() => void) => subscribeAction(store, listener),
    getCurrentState: (): CockpitState => ({ ...store.state }),
    startRecording: (): void => { startRecordingAction(store, loop, repository, foregroundService); },
    prepareStop: (): RouteMetadata | null => prepareStopAction(store, loop, foregroundService),
    confirmSaveRecording: (name: string): void => { confirmSaveRecordingAction(store, repository, name); },
    discardStop: (): void => { discardStopAction(store); },
    pauseRecording: (): void => { pauseRecordingAction(store, loop, foregroundService); },
    resumeRecording: (): void => { resumeRecordingAction(store, loop, foregroundService); },
    checkGpsPermission: (): Promise<boolean> => checkGpsPermissionAction(store, gps),
    requestGpsPermission: (): Promise<boolean> => requestGpsPermissionAction(store, gps),
  };
}
