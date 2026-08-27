import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import {
  startForegroundService,
  stopForegroundService,
  pauseRecordingLocation,
  resumeRecordingLocation,
  installUpdate,
  canInstallUpdatePackages,
  requestInstallUpdatePermission,
} from './commands.js';

describe('commands - foreground service + pause/resume wrappers', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('startForegroundService() invokes start_foreground_service', async () => {
    invokeMock.mockResolvedValue(undefined);
    await startForegroundService();
    expect(invokeMock).toHaveBeenCalledWith('start_foreground_service');
  });

  it('startForegroundService() absorbs invoke errors (web/desktop without the plugin)', async () => {
    invokeMock.mockRejectedValue(new Error('not available'));
    await expect(startForegroundService()).resolves.toBeUndefined();
  });

  it('stopForegroundService() invokes stop_foreground_service', async () => {
    invokeMock.mockResolvedValue(undefined);
    await stopForegroundService();
    expect(invokeMock).toHaveBeenCalledWith('stop_foreground_service');
  });

  it('stopForegroundService() absorbs invoke errors', async () => {
    invokeMock.mockRejectedValue(new Error('not available'));
    await expect(stopForegroundService()).resolves.toBeUndefined();
  });

  it('pauseRecordingLocation() invokes pause_recording_location', async () => {
    invokeMock.mockResolvedValue(undefined);
    await pauseRecordingLocation();
    expect(invokeMock).toHaveBeenCalledWith('pause_recording_location');
  });

  it('pauseRecordingLocation() absorbs invoke errors (command not implemented yet on this platform)', async () => {
    invokeMock.mockRejectedValue(new Error('command not found'));
    await expect(pauseRecordingLocation()).resolves.toBeUndefined();
  });

  it('resumeRecordingLocation() invokes resume_recording_location', async () => {
    invokeMock.mockResolvedValue(undefined);
    await resumeRecordingLocation();
    expect(invokeMock).toHaveBeenCalledWith('resume_recording_location');
  });

  it('resumeRecordingLocation() absorbs invoke errors', async () => {
    invokeMock.mockRejectedValue(new Error('command not found'));
    await expect(resumeRecordingLocation()).resolves.toBeUndefined();
  });
});

describe('commands - actualizacion-in-app install wrappers', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('installUpdate() invokes install_update with the given path', async () => {
    invokeMock.mockResolvedValue(undefined);
    await installUpdate('/cache/updates/update.apk');
    expect(invokeMock).toHaveBeenCalledWith('install_update', { path: '/cache/updates/update.apk' });
  });

  it('installUpdate() propagates invoke errors (invalid path, no plugin)', async () => {
    invokeMock.mockRejectedValue(new Error('Unexpected file name for an update APK'));
    await expect(installUpdate('/cache/updates/update.apk')).rejects.toThrow();
  });

  it('canInstallUpdatePackages() invokes can_install_update_packages and returns its result', async () => {
    invokeMock.mockResolvedValue(false);
    await expect(canInstallUpdatePackages()).resolves.toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('can_install_update_packages');
  });

  it('canInstallUpdatePackages() defaults to true if the command is not available (web/desktop)', async () => {
    invokeMock.mockRejectedValue(new Error('command not found'));
    await expect(canInstallUpdatePackages()).resolves.toBe(true);
  });

  it('requestInstallUpdatePermission() invokes request_install_update_permission', async () => {
    invokeMock.mockResolvedValue(undefined);
    await requestInstallUpdatePermission();
    expect(invokeMock).toHaveBeenCalledWith('request_install_update_permission');
  });

  it('requestInstallUpdatePermission() absorbs invoke errors', async () => {
    invokeMock.mockRejectedValue(new Error('command not found'));
    await expect(requestInstallUpdatePermission()).resolves.toBeUndefined();
  });
});
