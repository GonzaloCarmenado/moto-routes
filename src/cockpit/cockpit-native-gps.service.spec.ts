import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { EventCallback } from '@tauri-apps/api/event';

const { listenMock, isTauriMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

vi.mock('../shared/services/photo-capture-adapter.service.js', () => ({
  isTauri: isTauriMock,
}));

import {
  createNativeGpsProvider,
  isAndroidTauri,
  selectGpsProvider,
  NATIVE_LOCATION_EVENT,
  type NativeLocationEvent,
} from './cockpit-native-gps.service.js';
import type { GpsProvider } from './cockpit.service.js';

function createMockFallback(): GpsProvider {
  return {
    getCurrentPosition: vi.fn().mockResolvedValue({ coords: {}, timestamp: 0 }),
    watchPosition: vi.fn().mockReturnValue(vi.fn()),
    checkPermissions: vi.fn().mockResolvedValue(true),
    requestPermissions: vi.fn().mockResolvedValue(true),
  };
}

describe('createNativeGpsProvider', () => {
  let fallback: GpsProvider;
  let unlistenMock: Mock;

  beforeEach(() => {
    fallback = createMockFallback();
    unlistenMock = vi.fn();
    listenMock.mockReset();
    listenMock.mockResolvedValue(unlistenMock);
  });

  it('subscribes to the native location event and forwards the payload to the callback', async () => {
    const provider = createNativeGpsProvider(fallback);
    const callback = vi.fn();
    provider.watchPosition(callback);
    await Promise.resolve();
    await Promise.resolve();

    expect(listenMock).toHaveBeenCalledWith(NATIVE_LOCATION_EVENT, expect.any(Function));

    const handler = listenMock.mock.calls[0]?.[1] as EventCallback<NativeLocationEvent>;
    const payload: NativeLocationEvent = { lat: 40.1, lng: -3.2, alt: 650, speed: 8.33, timestamp: 12345 };
    handler({ event: NATIVE_LOCATION_EVENT, id: 1, payload });

    expect(callback).toHaveBeenCalledTimes(1);
    const posArg = callback.mock.calls[0]?.[0] as GeolocationPosition;
    expect(posArg.timestamp).toBe(12345);
    expect(posArg.coords.latitude).toBe(40.1);
    expect(posArg.coords.longitude).toBe(-3.2);
    expect(posArg.coords.altitude).toBe(650);
    // El speed se propaga tal cual, en m/s: la conversión a km/h la hace
    // createRecordingLoop.startWatch(), no debe convertirse dos veces aquí.
    expect(posArg.coords.speed).toBe(8.33);
  });

  it('the cleanup function returned by watchPosition() calls unlisten()', async () => {
    const provider = createNativeGpsProvider(fallback);
    const cleanup = provider.watchPosition(vi.fn());
    await Promise.resolve();
    await Promise.resolve();

    cleanup();
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it('getCurrentPosition() delegates to the fallback provider', async () => {
    const provider = createNativeGpsProvider(fallback);
    const result = await provider.getCurrentPosition();
    expect(fallback.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result).toEqual(await fallback.getCurrentPosition());
  });

  it('checkPermissions() delegates to the fallback provider', async () => {
    const provider = createNativeGpsProvider(fallback);
    const result = await provider.checkPermissions();
    expect(fallback.checkPermissions).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('requestPermissions() delegates to the fallback provider', async () => {
    const provider = createNativeGpsProvider(fallback);
    const result = await provider.requestPermissions();
    expect(fallback.requestPermissions).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});

describe('isAndroidTauri', () => {
  beforeEach(() => {
    isTauriMock.mockReset();
  });

  it('returns true only when isTauri() is true and the user agent contains "Android"', () => {
    isTauriMock.mockReturnValue(true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)' });
    expect(isAndroidTauri()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false when isTauri() is true but the user agent is not Android', () => {
    isTauriMock.mockReturnValue(true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(isAndroidTauri()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('returns false when isTauri() is false, even with an Android user agent', () => {
    isTauriMock.mockReturnValue(false);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)' });
    expect(isAndroidTauri()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('selectGpsProvider', () => {
  it('returns the native provider when isAndroid is true', () => {
    const native = createMockFallback();
    const browser = createMockFallback();
    expect(selectGpsProvider(true, native, browser)).toBe(native);
  });

  it('returns the browser provider when isAndroid is false', () => {
    const native = createMockFallback();
    const browser = createMockFallback();
    expect(selectGpsProvider(false, native, browser)).toBe(browser);
  });
});
