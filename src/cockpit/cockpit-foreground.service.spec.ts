import { describe, it, expect, vi, type Mock } from 'vitest';
import type * as CommandsModule from '../shared/tauri/commands.js';

const { startMock, stopMock, pauseMock, resumeMock } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue(undefined),
  stopMock: vi.fn().mockResolvedValue(undefined),
  pauseMock: vi.fn().mockResolvedValue(undefined),
  resumeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/tauri/commands.js', async (importOriginal) => {
  const actual = await importOriginal<typeof CommandsModule>();
  return {
    ...actual,
    startForegroundService: startMock,
    stopForegroundService: stopMock,
    pauseRecordingLocation: pauseMock,
    resumeRecordingLocation: resumeMock,
  };
});

import {
  createTauriForegroundServiceProvider,
  triggerForegroundService,
  triggerLocationPause,
  type ForegroundServiceProvider,
} from './cockpit-foreground.service.js';

function createMockProvider(): ForegroundServiceProvider {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    pauseLocationUpdates: vi.fn().mockResolvedValue(undefined),
    resumeLocationUpdates: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createTauriForegroundServiceProvider', () => {
  it('start() delegates to startForegroundService', async () => {
    await createTauriForegroundServiceProvider().start();
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('stop() delegates to stopForegroundService', async () => {
    await createTauriForegroundServiceProvider().stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('pauseLocationUpdates() delegates to pauseRecordingLocation', async () => {
    await createTauriForegroundServiceProvider().pauseLocationUpdates();
    expect(pauseMock).toHaveBeenCalledTimes(1);
  });

  it('resumeLocationUpdates() delegates to resumeRecordingLocation', async () => {
    await createTauriForegroundServiceProvider().resumeLocationUpdates();
    expect(resumeMock).toHaveBeenCalledTimes(1);
  });
});

describe('triggerForegroundService', () => {
  it('calls provider.start() when active is true', () => {
    const provider = createMockProvider();
    triggerForegroundService(provider, true);
    expect(provider.start).toHaveBeenCalledTimes(1);
    expect(provider.stop).not.toHaveBeenCalled();
  });

  it('calls provider.stop() when active is false', () => {
    const provider = createMockProvider();
    triggerForegroundService(provider, false);
    expect(provider.stop).toHaveBeenCalledTimes(1);
    expect(provider.start).not.toHaveBeenCalled();
  });

  it('does not throw when provider is undefined', () => {
    expect(() => { triggerForegroundService(undefined, true); }).not.toThrow();
  });

  it('never lets a rejected promise become an unhandled rejection', async () => {
    const provider = createMockProvider();
    (provider.start as Mock).mockRejectedValue(new Error('boom'));
    expect(() => { triggerForegroundService(provider, true); }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe('triggerLocationPause', () => {
  it('calls provider.pauseLocationUpdates() when paused is true', () => {
    const provider = createMockProvider();
    triggerLocationPause(provider, true);
    expect(provider.pauseLocationUpdates).toHaveBeenCalledTimes(1);
    expect(provider.resumeLocationUpdates).not.toHaveBeenCalled();
  });

  it('calls provider.resumeLocationUpdates() when paused is false', () => {
    const provider = createMockProvider();
    triggerLocationPause(provider, false);
    expect(provider.resumeLocationUpdates).toHaveBeenCalledTimes(1);
    expect(provider.pauseLocationUpdates).not.toHaveBeenCalled();
  });

  it('does not throw when provider is undefined', () => {
    expect(() => { triggerLocationPause(undefined, true); }).not.toThrow();
  });

  it('never lets a rejected promise become an unhandled rejection', async () => {
    const provider = createMockProvider();
    (provider.pauseLocationUpdates as Mock).mockRejectedValue(new Error('boom'));
    expect(() => { triggerLocationPause(provider, true); }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});
