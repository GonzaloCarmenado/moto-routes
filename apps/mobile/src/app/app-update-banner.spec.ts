import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as AppUpdateBannerModule from './app-update-banner.js';

const checkForUpdateMock = vi.fn();
const notifyUpdateAvailableMock = vi.fn();
const downloadUpdateMock = vi.fn();
const installUpdateMock = vi.fn();
const canInstallUpdatePackagesMock = vi.fn();
const requestInstallUpdatePermissionMock = vi.fn();

vi.mock('../update/update-banner.element.js', () => ({}));
vi.mock('../update/update-check.service.js', () => ({ checkForUpdate: checkForUpdateMock }));
vi.mock('../update/update-notification.service.js', () => ({ notifyUpdateAvailable: notifyUpdateAvailableMock }));
vi.mock('../update/update-download.service.js', () => ({ downloadUpdate: downloadUpdateMock }));
vi.mock('../shared/tauri/commands.js', () => ({
  installUpdate: installUpdateMock,
  canInstallUpdatePackages: canInstallUpdatePackagesMock,
  requestInstallUpdatePermission: requestInstallUpdatePermissionMock,
}));

async function importModule(): Promise<typeof AppUpdateBannerModule> {
  return import('./app-update-banner.js');
}

describe('mountUpdateBanner', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates and appends an update-banner element to the given host, and wires its events', async () => {
    const { mountUpdateBanner } = await importModule();
    const host = document.createElement('div');

    const { element, unlisten } = mountUpdateBanner(host);

    expect(element.tagName.toLowerCase()).toBe('update-banner');
    expect(host.contains(element)).toBe(true);
    unlisten(); // no dejar el listener de window colgado para el resto de tests de este fichero
  });

  it('unlisten() removes the update event listeners', async () => {
    const { mountUpdateBanner } = await importModule();
    const host = document.createElement('div');

    const { unlisten } = mountUpdateBanner(host);
    const handler = vi.fn();
    window.addEventListener('update-download-requested', handler);
    unlisten();
    window.dispatchEvent(new CustomEvent('update-download-requested', { detail: { downloadUrl: 'x', latestVersion: '1' } }));
    window.removeEventListener('update-download-requested', handler);

    // El propio módulo también escuchaba ese evento -- tras unlisten(), downloadUpdate no debería llamarse.
    expect(downloadUpdateMock).not.toHaveBeenCalled();
  });
});

describe('checkForUpdateAndReflect', () => {
  beforeEach(() => {
    vi.resetModules();
    checkForUpdateMock.mockReset();
    notifyUpdateAvailableMock.mockReset();
  });

  it('reflects the result on the banner and notifies when an update is available', async () => {
    checkForUpdateMock.mockResolvedValue({ hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' });
    const { checkForUpdateAndReflect } = await importModule();
    const banner = document.createElement('div') as HTMLElement & { result?: unknown };

    checkForUpdateAndReflect(banner);
    await vi.waitFor(() => {
      expect(banner.result).toEqual({ hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' });
    });

    expect(notifyUpdateAvailableMock).toHaveBeenCalledWith('0.1.18');
  });

  it('reflects the result on the banner without notifying when there is no update', async () => {
    checkForUpdateMock.mockResolvedValue({ hasUpdate: false, latestVersion: null, downloadUrl: null });
    const { checkForUpdateAndReflect } = await importModule();
    const banner = document.createElement('div') as HTMLElement & { result?: unknown };

    checkForUpdateAndReflect(banner);
    await vi.waitFor(() => {
      expect(banner.result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
    });

    expect(notifyUpdateAvailableMock).not.toHaveBeenCalled();
  });
});

describe('handleUpdateDownloadRequested', () => {
  beforeEach(() => {
    vi.resetModules();
    downloadUpdateMock.mockReset();
  });

  it('reports progress and sets the banner ready to install on success', async () => {
    downloadUpdateMock.mockImplementation(
      ({ onProgress }: { onProgress: (p: { loaded: number; total: number | null }) => void }) => {
        onProgress({ loaded: 5, total: 10 });
        return Promise.resolve('/cache/updates/update.apk');
      },
    );
    const { handleUpdateDownloadRequested } = await importModule();
    const banner = document.createElement('div') as HTMLElement & {
      setDownloading?: (p: unknown) => void;
      setReadyToInstall?: () => void;
    };
    banner.setDownloading = vi.fn();
    banner.setReadyToInstall = vi.fn();

    handleUpdateDownloadRequested(banner, 'https://example.com/apk');
    await vi.waitFor(() => {
      expect(banner.setReadyToInstall).toHaveBeenCalledOnce();
    });

    expect(banner.setDownloading).toHaveBeenCalledWith({ loaded: 5, total: 10 });
  });

  it('sets the banner to error state when the download fails', async () => {
    downloadUpdateMock.mockRejectedValue(new Error('network down'));
    const { handleUpdateDownloadRequested } = await importModule();
    const banner = document.createElement('div') as HTMLElement & { setDownloadError?: (m: string) => void };
    banner.setDownloadError = vi.fn();

    handleUpdateDownloadRequested(banner, 'https://example.com/apk');
    await vi.waitFor(() => {
      expect(banner.setDownloadError).toHaveBeenCalledWith('network down');
    });
  });
});

describe('handleUpdateInstallRequested', () => {
  beforeEach(() => {
    vi.resetModules();
    downloadUpdateMock.mockReset();
    installUpdateMock.mockReset();
    canInstallUpdatePackagesMock.mockReset();
    requestInstallUpdatePermissionMock.mockReset();
  });

  it('does nothing if no APK has been downloaded yet', async () => {
    const { handleUpdateInstallRequested } = await importModule();

    await handleUpdateInstallRequested();

    expect(canInstallUpdatePackagesMock).not.toHaveBeenCalled();
  });

  it('installs the downloaded APK when the permission is already granted', async () => {
    downloadUpdateMock.mockResolvedValue('/cache/updates/update.apk');
    canInstallUpdatePackagesMock.mockResolvedValue(true);
    const { handleUpdateDownloadRequested, handleUpdateInstallRequested } = await importModule();
    const banner = document.createElement('div') as HTMLElement & { setReadyToInstall?: () => void };
    banner.setReadyToInstall = vi.fn();

    handleUpdateDownloadRequested(banner, 'https://example.com/apk');
    await vi.waitFor(() => {
      expect(banner.setReadyToInstall).toHaveBeenCalledOnce();
    });
    await handleUpdateInstallRequested();

    expect(installUpdateMock).toHaveBeenCalledWith('/cache/updates/update.apk');
  });

  it('requests the install permission instead of installing when it is not granted', async () => {
    downloadUpdateMock.mockResolvedValue('/cache/updates/update.apk');
    canInstallUpdatePackagesMock.mockResolvedValue(false);
    const { handleUpdateDownloadRequested, handleUpdateInstallRequested } = await importModule();
    const banner = document.createElement('div') as HTMLElement & { setReadyToInstall?: () => void };
    banner.setReadyToInstall = vi.fn();

    handleUpdateDownloadRequested(banner, 'https://example.com/apk');
    await vi.waitFor(() => {
      expect(banner.setReadyToInstall).toHaveBeenCalledOnce();
    });
    await handleUpdateInstallRequested();

    expect(requestInstallUpdatePermissionMock).toHaveBeenCalledOnce();
    expect(installUpdateMock).not.toHaveBeenCalled();
  });
});
