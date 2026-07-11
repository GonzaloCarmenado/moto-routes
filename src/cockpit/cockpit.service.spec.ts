import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createCockpitService, type GpsProvider, type StorageProvider } from './cockpit.service.js';
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

describe('createCockpitService', () => {
  let gps: GpsProvider;
  let service: ReturnType<typeof createCockpitService>;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    service = createCockpitService(gps, createMockStorage());
  });

  it('should start in idle state', () => {
    const state = service.getCurrentState();
    expect(state.status).toBe('idle');
    expect(state.currentSpeed).toBe(0);
    expect(state.points).toEqual([]);
    expect(state.hasGpsPermission).toBe(false);
    expect(state.invisibleMode).toBe(false);
  });

  it('should start recording', () => {
    service.startRecording();
    const state = service.getCurrentState();
    expect(state.status).toBe('recording');
  });

  it('should ignore start if already recording', () => {
    service.startRecording();
    service.startRecording(); // second call ignored
    const state = service.getCurrentState();
    expect(state.status).toBe('recording');
  });

  it('should stop recording and return metadata', () => {
    service.startRecording();
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
    const state = service.getCurrentState();
    expect(state.status).toBe('idle');
  });

  it('should return null on stop when idle', () => {
    expect(service.stopRecording()).toBeNull();
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

  it('should toggle invisible mode', () => {
    service.setInvisibleMode(true);
    expect(service.getCurrentState().invisibleMode).toBe(true);
    service.setInvisibleMode(false);
    expect(service.getCurrentState().invisibleMode).toBe(false);
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

  function getWatchCallback(): (pos: GeolocationPosition) => void {
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

  it('should add GPS points via watchPosition callback', () => {
    const fireWatch = getWatchCallback();
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
    const fireWatch = getWatchCallback();
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

  it('should increment elapsed time via interval', () => {
    service.startRecording();
    expect(service.getCurrentState().elapsedTime).toBe(0);

    vi.advanceTimersByTime(3000);
    expect(service.getCurrentState().elapsedTime).toBe(3);
  });

  it('should stop GPS watch and tick on stop', () => {
    const cleanupWatch = vi.fn();
    (gps.watchPosition as Mock).mockReturnValue(cleanupWatch);

    service.startRecording();
    vi.advanceTimersByTime(2000);
    service.stopRecording();

    expect(cleanupWatch).toHaveBeenCalled();
    const elapsedAfterStop = service.getCurrentState().elapsedTime;
    vi.advanceTimersByTime(1000);
    expect(service.getCurrentState().elapsedTime).toBe(elapsedAfterStop);
  });

  it('should handle gps signal loss (speed null safety)', () => {
    const fireWatch = getWatchCallback();
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

  it('should build metadata with route info after recording', () => {
    service.startRecording();
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
    if (metadata) {
      expect(typeof metadata.date).toBe('string');
      expect(metadata.duration).toBeGreaterThanOrEqual(0);
      expect(typeof metadata.totalDistance).toBe('number');
      expect(typeof metadata.avgSpeed).toBe('number');
    }
  });

  it('should preserve gps permission after stop', async () => {
    await service.checkGpsPermission();
    service.startRecording();
    service.stopRecording();
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });

  it('should notify on each state change', () => {
    const listener = vi.fn();
    service.subscribe(listener);
    listener.mockClear();

    service.setInvisibleMode(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const stateArg = listener.mock.calls[0]![0] as { invisibleMode: boolean };
    expect(stateArg.invisibleMode).toBe(true);
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

describe('createCockpitService with repository', () => {
  let gps: GpsProvider;
  let repo: MemoryRouteRepository;

  beforeEach(() => {
    vi.useFakeTimers();
    gps = createMockGps();
    repo = new MemoryRouteRepository();
  });

  it('should persist route on stopRecording when repository provided', async () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    service.stopRecording();
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.duration).toBeGreaterThanOrEqual(0);
  });

  it('should still return metadata even if repository is provided', () => {
    const service = createCockpitService(gps, createMockStorage(), repo);
    service.startRecording();
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
  });

  it('should work without repository (backwards compat)', () => {
    const service = createCockpitService(gps, createMockStorage());
    service.startRecording();
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
  });
});