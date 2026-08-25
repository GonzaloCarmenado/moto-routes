import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as AppUpdateBannerModule from './app-update-banner.js';

const checkForUpdateMock = vi.fn();
const notifyUpdateAvailableMock = vi.fn();

vi.mock('../update/update-banner.element.js', () => ({}));
vi.mock('../update/update-check.service.js', () => ({ checkForUpdate: checkForUpdateMock }));
vi.mock('../update/update-notification.service.js', () => ({ notifyUpdateAvailable: notifyUpdateAvailableMock }));

async function importModule(): Promise<typeof AppUpdateBannerModule> {
  return import('./app-update-banner.js');
}

describe('mountUpdateBanner', () => {
  it('creates and appends an update-banner element to the given host', async () => {
    const { mountUpdateBanner } = await importModule();
    const host = document.createElement('div');

    const banner = mountUpdateBanner(host);

    expect(banner.tagName.toLowerCase()).toBe('update-banner');
    expect(host.contains(banner)).toBe(true);
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
