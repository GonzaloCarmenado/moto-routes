import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createCockpitService, type GpsProvider, type StorageProvider, type ForegroundServiceProvider } from './cockpit.service.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';

function createMockGps(): GpsProvider {
  return {
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: {
        latitude: 40.4168,
        longitude: -3.7038,
        altitude: 650,
        speed: 0,
        accuracy: 10,
        altitudeAccuracy: 10,
        heading: 0,
      },
      timestamp: Date.now(),
    }),
    watchPosition: vi.fn().mockReturnValue(vi.fn()),
    checkPermissions: vi.fn().mockResolvedValue(true),
    requestPermissions: vi.fn().mockResolvedValue(true),
  };
}

function createMockStorage(): StorageProvider {
  return {
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockForegroundService(): ForegroundServiceProvider {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };
}

function mockWatchCallback(gps: GpsProvider): (pos: GeolocationPosition) => void {
  let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
  const watchMock = vi.fn().mockImplementation((cb: (pos: GeolocationPosition) => void) => {
    watchCallback = cb;
    return vi.fn();
  });
  gps.watchPosition = watchMock;
  return (pos: GeolocationPosition): void => {
    if (watchCallback) watchCallback(pos);
  };
}

describe('createCockpitService - estado de grabación', () => {
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createCockpitService(createMockGps(), createMockStorage());
  });

  it('should start in idle state', () => {
    const state = service.getCurrentState();
    expect(state.status).toBe('idle');
    expect(state.currentSpeed).toBe(0);
    expect(state.points).toEqual([]);
    expect(state.hasGpsPermission).toBe(false);
    expect(typeof state.routeId).toBe('string');
    expect(state.routeId.length).toBeGreaterThan(0);
  });

  it('should start recording', () => {
    service.startRecording();
    expect(service.getCurrentState().status).toBe('recording');
  });

  it('should ignore start if already recording', () => {
    service.startRecording();
    service.startRecording(); // second call ignored
    expect(service.getCurrentState().status).toBe('recording');
  });

  it('should prepare stop (freeze) returning metadata, without resetting until confirmed', () => {
    service.startRecording();
    const metadata = service.prepareStop();
    expect(metadata).not.toBeNull();
    // Sigue "recording" — la decisión de guardar/descartar no se ha tomado todavía
    expect(service.getCurrentState().status).toBe('recording');

    service.confirmSaveRecording();
    expect(service.getCurrentState().status).toBe('idle');
  });

  it('should return null on prepareStop when idle', () => {
    expect(service.prepareStop()).toBeNull();
  });

  it('should reset to idle without persisting when discarded', () => {
    service.startRecording();
    service.prepareStop();
    service.discardStop();
    expect(service.getCurrentState().status).toBe('idle');
  });

  it('should pause and resume recording', () => {
    service.startRecording();
    service.pauseRecording();
    expect(service.getCurrentState().status).toBe('paused');
    service.resumeRecording();
    expect(service.getCurrentState().status).toBe('recording');
  });

  it('should ignore pause when not recording', () => {
    service.pauseRecording(); // idle → noop
    expect(service.getCurrentState().status).toBe('idle');
  });

  it('should ignore resume when not paused', () => {
    service.resumeRecording(); // idle → noop
    expect(service.getCurrentState().status).toBe('idle');
  });
});

describe('createCockpitService - notificaciones a listeners', () => {
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createCockpitService(createMockGps(), createMockStorage());
  });

  it('should notify listeners on state change', () => {
    const listener = vi.fn();
    service.subscribe(listener);
    service.startRecording();
    expect(listener).toHaveBeenCalled();
  });

  it('should unsubscribe listeners', () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    unsubscribe();
    service.startRecording();
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify on each state change', () => {
    service.startRecording();
    const listener = vi.fn();
    service.subscribe(listener);
    listener.mockClear();

    service.pauseRecording();
    expect(listener).toHaveBeenCalledTimes(1);
    const stateArg = listener.mock.calls[0]![0] as { status: string };
    expect(stateArg.status).toBe('paused');
  });

  it('should pass snapshot (clone) to listeners', () => {
    const listener = vi.fn();
    service.subscribe(listener);
    service.startRecording();
    const stateArg = listener.mock.calls[0]![0] as { status: string };
    stateArg.status = 'paused';
    expect(service.getCurrentState().status).toBe('recording');
  });
});

describe('createCockpitService - permisos GPS', () => {
  let gps: GpsProvider;
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    service = createCockpitService(gps, createMockStorage());
  });

  it('should check permissions', async () => {
    const ok = await service.checkGpsPermission();
    expect(ok).toBe(true);
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });

  it('should request permissions', async () => {
    const ok = await service.requestGpsPermission();
    expect(ok).toBe(true);
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });

  it('should return false when requestPermissions fails', async () => {
    (gps.requestPermissions as Mock).mockResolvedValue(false);
    const ok = await service.requestGpsPermission();
    expect(ok).toBe(false);
    expect(service.getCurrentState().hasGpsPermission).toBe(false);
  });

  it('should return false when checkPermissions fails', async () => {
    (gps.checkPermissions as Mock).mockResolvedValue(false);
    const ok = await service.checkGpsPermission();
    expect(ok).toBe(false);
    expect(service.getCurrentState().hasGpsPermission).toBe(false);
  });
});

describe('createCockpitService - puntos GPS y distancia', () => {
  let gps: GpsProvider;
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    service = createCockpitService(gps, createMockStorage());
  });

  it('should add GPS points via watchPosition callback', () => {
    const fireWatch = mockWatchCallback(gps);
    service.startRecording();

    const fakePos = {
      coords: {
        latitude: 41.38,
        longitude: 2.18,
        altitude: 10,
        speed: 8.33,
        accuracy: 10,
        altitudeAccuracy: 10,
        heading: 0,
      },
      timestamp: Date.now(),
    } as GeolocationPosition;

    fireWatch(fakePos);

    const state = service.getCurrentState();
    expect(state.points).toHaveLength(1);
    expect(state.points[0]!.lat).toBe(41.38);
    expect(state.points[0]!.lng).toBe(2.18);
    expect(state.currentSpeed).toBeCloseTo(30, 0);
  });

  it('should accumulate distance across multiple points', () => {
    const fireWatch = mockWatchCallback(gps);
    service.startRecording();

    fireWatch({
      coords: { latitude: 0, longitude: 0, altitude: 0, speed: 0, accuracy: 10, altitudeAccuracy: 10, heading: 0 },
      timestamp: 1000,
    } as GeolocationPosition);

    fireWatch({
      coords: { latitude: 1, longitude: 0, altitude: 0, speed: 0, accuracy: 10, altitudeAccuracy: 10, heading: 0 },
      timestamp: 2000,
    } as GeolocationPosition);

    const state = service.getCurrentState();
    expect(state.points).toHaveLength(2);
    expect(state.totalDistance).toBeGreaterThan(0);
  });

  it('should handle gps signal loss (speed null safety)', () => {
    const fireWatch = mockWatchCallback(gps);
    service.startRecording();

    fireWatch({
      coords: { latitude: 0, longitude: 0, altitude: null, speed: null, accuracy: 10, altitudeAccuracy: null, heading: null },
      timestamp: 1000,
    } as unknown as GeolocationPosition);

    const state = service.getCurrentState();
    expect(state.points).toHaveLength(1);
    expect(state.points[0]!.speed).toBe(0);
    expect(state.points[0]!.alt).toBe(0);
  });
});

describe('createCockpitService - temporizador', () => {
  let gps: GpsProvider;
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    service = createCockpitService(gps, createMockStorage());
  });

  it('should increment elapsed time via interval', () => {
    service.startRecording();
    expect(service.getCurrentState().elapsedTime).toBe(0);

    vi.advanceTimersByTime(3000);
    expect(service.getCurrentState().elapsedTime).toBe(3);
  });

  it('should stop GPS watch and tick as soon as prepareStop is called (before any save/discard decision)', () => {
    const cleanupWatch = vi.fn();
    (gps.watchPosition as Mock).mockReturnValue(cleanupWatch);

    service.startRecording();
    vi.advanceTimersByTime(2000);
    service.prepareStop();

    expect(cleanupWatch).toHaveBeenCalled();
    const elapsedAfterStop = service.getCurrentState().elapsedTime;
    vi.advanceTimersByTime(1000);
    expect(service.getCurrentState().elapsedTime).toBe(elapsedAfterStop);
  });
});

describe('createCockpitService - metadata al finalizar', () => {
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createCockpitService(createMockGps(), createMockStorage());
  });

  it('should build metadata with route info on prepareStop', () => {
    service.startRecording();
    const metadata = service.prepareStop();
    expect(metadata).not.toBeNull();
    if (metadata) {
      expect(typeof metadata.date).toBe('string');
      expect(metadata.duration).toBeGreaterThanOrEqual(0);
      expect(typeof metadata.totalDistance).toBe('number');
      expect(typeof metadata.avgSpeed).toBe('number');
    }
  });

  it('should preserve gps permission after a full prepareStop+confirmSaveRecording cycle', async () => {
    await service.checkGpsPermission();
    service.startRecording();
    service.prepareStop();
    service.confirmSaveRecording();
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });

  it('should preserve gps permission after discarding too', async () => {
    await service.checkGpsPermission();
    service.startRecording();
    service.prepareStop();
    service.discardStop();
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });
});

describe('createCockpitService with repository', () => {
  let gps: GpsProvider;
  let repo: MemoryRouteRepository;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    repo = new MemoryRouteRepository();
  });

  it('should persist route on confirmSaveRecording when repository provided', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    service.prepareStop();
    service.confirmSaveRecording();
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.duration).toBeGreaterThanOrEqual(0);
  });

  it('should NOT persist a completed row when the recording is discarded instead of confirmed', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const routeId = service.getCurrentState().routeId;
    service.prepareStop();
    service.discardStop();

    // La fila 'active' pre-generada al arrancar sigue ahí (discardStop no la toca:
    // borrarla es responsabilidad de deleteRouteAndPhotos, orquestado por el llamador),
    // pero nunca se actualiza a 'completed'.
    const saved = await repo.getById(routeId);
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe('active');
  });

  it('should persist an active route row immediately when recording starts, before it is stopped (regression: photos captured mid-recording violated the photos.route_id FOREIGN KEY because no route row existed yet)', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    await Promise.resolve();

    const routeIdDuringRecording = service.getCurrentState().routeId;
    const saved = await repo.getById(routeIdDuringRecording);
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe('active');
  });

  it('should update the same row (not create a second one) when the route is later confirmed', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    await Promise.resolve();
    const routeId = service.getCurrentState().routeId;

    service.prepareStop();
    service.confirmSaveRecording();

    const all = await repo.getAll();
    expect(all.filter((r) => r.id === routeId)).toHaveLength(1);
    const finalRoute = await repo.getById(routeId);
    expect(finalRoute!.status).toBe('completed');
  });

  it('should still return metadata from prepareStop even if repository is provided', () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const metadata = service.prepareStop();
    expect(metadata).not.toBeNull();
  });

  it('should work without repository (backwards compat)', () => {
    const service = createCockpitService(gps, createMockStorage());
    service.startRecording();
    const metadata = service.prepareStop();
    expect(metadata).not.toBeNull();
    expect(() => { service.confirmSaveRecording(); }).not.toThrow();
  });

  it('should persist the route using the routeId pre-generated in state (photos taken mid-recording stay linked)', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const routeIdDuringRecording = service.getCurrentState().routeId;

    service.prepareStop();
    service.confirmSaveRecording();

    const saved = await repo.getById(routeIdDuringRecording);
    expect(saved).not.toBeNull();
    expect(saved!.id).toBe(routeIdDuringRecording);
  });

  it('should generate a fresh routeId for the next recording after confirming', () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const firstRouteId = service.getCurrentState().routeId;
    service.prepareStop();
    service.confirmSaveRecording();
    const nextRouteId = service.getCurrentState().routeId;
    expect(nextRouteId).not.toBe(firstRouteId);
  });

  it('should also generate a fresh routeId for the next recording after discarding', () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const firstRouteId = service.getCurrentState().routeId;
    service.prepareStop();
    service.discardStop();
    const nextRouteId = service.getCurrentState().routeId;
    expect(nextRouteId).not.toBe(firstRouteId);
  });

  it('should persist a simplified previewPolyline (max ~40 points, matching first/last recorded GPS point) on confirmSaveRecording (AC-019)', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    const fireWatch = mockWatchCallback(gps);
    service.startRecording();
    const routeId = service.getCurrentState().routeId;

    const firstPos = {
      coords: { latitude: 40.0, longitude: -3.0, altitude: 10, speed: 5, accuracy: 10, altitudeAccuracy: 10, heading: 0 },
      timestamp: 1000,
    } as GeolocationPosition;
    fireWatch(firstPos);

    for (let i = 1; i < 49; i++) {
      fireWatch({
        coords: {
          latitude: 40.0 + i * 0.001,
          longitude: -3.0 + i * 0.001,
          altitude: 10,
          speed: 5,
          accuracy: 10,
          altitudeAccuracy: 10,
          heading: 0,
        },
        timestamp: 1000 + i * 1000,
      } as GeolocationPosition);
    }
    const lastPos = {
      coords: { latitude: 41.0, longitude: -2.0, altitude: 10, speed: 5, accuracy: 10, altitudeAccuracy: 10, heading: 0 },
      timestamp: 60000,
    } as GeolocationPosition;
    fireWatch(lastPos);

    const recordedPoints = service.getCurrentState().points;
    expect(recordedPoints.length).toBe(50);

    service.prepareStop();
    service.confirmSaveRecording();

    const saved = await repo.getById(routeId);
    expect(saved).not.toBeNull();
    expect(saved!.previewPolyline).not.toBeNull();
    expect(saved!.previewPolyline!.length).toBeLessThanOrEqual(40);
    expect(saved!.previewPolyline![0]).toEqual([recordedPoints[0]!.lat, recordedPoints[0]!.lng]);
    expect(saved!.previewPolyline![saved!.previewPolyline!.length - 1]).toEqual([
      recordedPoints[recordedPoints.length - 1]!.lat,
      recordedPoints[recordedPoints.length - 1]!.lng,
    ]);
  });

  it('should persist an empty previewPolyline without breaking the rest of the save when no GPS point was recorded', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const routeId = service.getCurrentState().routeId;

    service.prepareStop();
    service.confirmSaveRecording();

    const saved = await repo.getById(routeId);
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe('completed');
    expect(saved!.previewPolyline).toEqual([]);
  });
});

describe('createCockpitService - foreground service (grabación en segundo plano siempre activa)', () => {
  let gps: GpsProvider;
  let storage: StorageProvider;
  let foregroundService: ForegroundServiceProvider;
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    storage = createMockStorage();
    foregroundService = createMockForegroundService();
    service = createCockpitService(gps, storage, undefined, foregroundService);
  });

  it('should start the native foreground service as soon as a recording starts, without any toggle', () => {
    service.startRecording();
    expect(foregroundService.start).toHaveBeenCalledTimes(1);
  });

  it('should not restart the foreground service on pause/resume (GPS watch keeps running while paused)', () => {
    service.startRecording();
    (foregroundService.start as Mock).mockClear();
    service.pauseRecording();
    service.resumeRecording();
    expect(foregroundService.start).not.toHaveBeenCalled();
  });

  it('should stop the native foreground service once the recording is stopped (prepareStop)', () => {
    service.startRecording();
    service.prepareStop();
    expect(foregroundService.stop).toHaveBeenCalledTimes(1);
  });

  it('should not call foregroundService.stop on prepareStop when idle (no recording was ever started)', () => {
    service.prepareStop();
    expect(foregroundService.stop).not.toHaveBeenCalled();
  });

  it('should work without a foregroundService provided (backwards compat)', () => {
    const plainService = createCockpitService(gps, storage);
    expect(() => {
      plainService.startRecording();
      plainService.prepareStop();
    }).not.toThrow();
  });
});
