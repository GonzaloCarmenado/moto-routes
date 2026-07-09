import { describe, it, expect, vi } from 'vitest';
import { createCockpitService, type GpsProvider, type StorageProvider } from './cockpit.service.js';

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
  it('should start in idle state', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    const state = service.getCurrentState();
    expect(state.status).toBe('idle');
    expect(state.currentSpeed).toBe(0);
  });

  it('should start recording', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.startRecording();
    const state = service.getCurrentState();
    expect(state.status).toBe('recording');
  });

  it('should ignore start if already recording', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.startRecording();
    service.startRecording(); // second call ignored
    const state = service.getCurrentState();
    expect(state.status).toBe('recording');
  });

  it('should stop recording and return metadata', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.startRecording();
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
    const state = service.getCurrentState();
    expect(state.status).toBe('idle');
  });

  it('should return null on stop when idle', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    expect(service.stopRecording()).toBeNull();
  });

  it('should pause and resume recording', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.startRecording();
    service.pauseRecording();
    expect(service.getCurrentState().status).toBe('paused');
    service.resumeRecording();
    expect(service.getCurrentState().status).toBe('recording');
  });

  it('should notify listeners on state change', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    const listener = vi.fn();
    service.subscribe(listener);
    service.startRecording();
    expect(listener).toHaveBeenCalled();
  });

  it('should unsubscribe listeners', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    unsubscribe();
    service.startRecording();
    expect(listener).not.toHaveBeenCalled();
  });

  it('should toggle invisible mode', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.setInvisibleMode(true);
    expect(service.getCurrentState().invisibleMode).toBe(true);
    service.setInvisibleMode(false);
    expect(service.getCurrentState().invisibleMode).toBe(false);
  });

  it('should check permissions', async () => {
    const gps = createMockGps();
    const service = createCockpitService(gps, createMockStorage());
    const ok = await service.checkGpsPermission();
    expect(ok).toBe(true);
    expect(service.getCurrentState().hasGpsPermission).toBe(true);
  });

  it('should build metadata with route info after recording', () => {
    const service = createCockpitService(createMockGps(), createMockStorage());
    service.startRecording();

    // Simular que pasó tiempo
    const metadata = service.stopRecording();
    expect(metadata).not.toBeNull();
    if (metadata) {
      expect(typeof metadata.date).toBe('string');
      expect(metadata.duration).toBeGreaterThanOrEqual(0);
      expect(typeof metadata.totalDistance).toBe('number');
      expect(typeof metadata.avgSpeed).toBe('number');
    }
  });
});