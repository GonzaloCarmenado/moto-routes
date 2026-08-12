import { describe, it, expect, afterEach, vi } from 'vitest';
import { createBrowserGpsProvider } from './cockpit-browser-gps.service.js';

const originalGeolocation = globalThis.navigator.geolocation as Geolocation | undefined;

afterEach(() => {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: originalGeolocation,
    writable: true,
    configurable: true,
  });
});

function mockGeolocation(overrides: Partial<Geolocation>): void {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: overrides,
    writable: true,
    configurable: true,
  });
}

describe('createBrowserGpsProvider - getCurrentPosition()', () => {
  it('resolves with the position reported by the browser', async () => {
    const position = {
      coords: { latitude: 40.4, longitude: -3.7, altitude: 650, speed: 12, accuracy: 5, altitudeAccuracy: 3, heading: 90 },
      timestamp: Date.now(),
    } as GeolocationPosition;
    mockGeolocation({
      getCurrentPosition: (success) => { success(position); },
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.getCurrentPosition()).resolves.toEqual(position);
  });

  it('rejects with the error reported by the browser', async () => {
    const error = { code: 2, message: 'position unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
    mockGeolocation({
      getCurrentPosition: (_success, failure) => { failure?.(error); },
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.getCurrentPosition()).rejects.toEqual(error);
  });
});

describe('createBrowserGpsProvider - watchPosition()', () => {
  it('forwards the callback to navigator.geolocation.watchPosition and returns an unsubscribe function', () => {
    const watchId = 42;
    const watchPositionMock = vi.fn().mockReturnValue(watchId);
    const clearWatchMock = vi.fn();
    mockGeolocation({ watchPosition: watchPositionMock, clearWatch: clearWatchMock });

    const provider = createBrowserGpsProvider();
    const callback = vi.fn();
    const unsubscribe = provider.watchPosition(callback);

    expect(watchPositionMock).toHaveBeenCalledWith(callback, expect.any(Function));

    unsubscribe();
    expect(clearWatchMock).toHaveBeenCalledWith(watchId);
  });

  it('silently ignores watch errors instead of throwing', () => {
    const watchPositionMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({ code: 3, message: 'timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      return 1;
    });
    mockGeolocation({ watchPosition: watchPositionMock, clearWatch: vi.fn() });

    const provider = createBrowserGpsProvider();
    expect(() => provider.watchPosition(vi.fn())).not.toThrow();
  });
});

// Regresión del crash real: Android revocaba el permiso de ubicación en el
// SO (p. ej. tras reinstalar el APK) pero la comprobación de entonces no lo
// detectaba, así que `hasGpsPermission` quedaba `true` de mentira y
// `handleStartStop()` dejaba pasar a `startRecording()` sin mostrar el
// overlay de permiso — el foreground service nativo (`RecordingService.kt`)
// crasheaba la app entera al llamar `startForeground(type=location)` sin el
// permiso real concedido. Este describe cubrió antes `navigator.permissions
// .query()`, sustituido (2026-08-05) por un sondeo real vía
// `getCurrentPosition()`: en el WebView real de Android la Permissions API
// se quedaba encallada en 'prompt' con el permiso del SO ya concedido de
// verdad (confirmado en dispositivo), mostrando el overlay en cada apertura.
// Movido aquí desde cockpit.service.spec.ts (openspec/changes/
// limpieza-tecnica-monorepo) para colocar el test junto al fichero real.
describe('createBrowserGpsProvider - checkPermissions()/requestPermissions()', () => {
  it('resolves false when the browser reports the geolocation permission as denied', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      },
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.checkPermissions()).resolves.toBe(false);
    await expect(provider.requestPermissions()).resolves.toBe(false);
  });

  it('resolves true when a position is obtained (permission granted)', async () => {
    mockGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 0, longitude: 0, altitude: 0, speed: 0, accuracy: 0, altitudeAccuracy: 0, heading: 0 },
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.checkPermissions()).resolves.toBe(true);
    await expect(provider.requestPermissions()).resolves.toBe(true);
  });

  it('resolves true (not denied) on TIMEOUT/POSITION_UNAVAILABLE — lack of signal is not lack of permission', async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 3, message: 'timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      },
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.checkPermissions()).resolves.toBe(true);
  });

  it('resolves false when navigator.geolocation is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const provider = createBrowserGpsProvider();
    await expect(provider.checkPermissions()).resolves.toBe(false);
  });
});
