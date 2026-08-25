import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as UpdateCheckModule from './update-check.service.js';

const getVersionMock = vi.fn();
const fetchMock = vi.fn();
const isTauriMock = vi.fn();

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: getVersionMock,
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: fetchMock,
}));

vi.mock('../shared/services/photo-capture-adapter.service.js', () => ({
  isTauri: isTauriMock,
}));

async function importService(): Promise<typeof UpdateCheckModule> {
  return import('./update-check.service.js');
}

function mockUserAgent(userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
}

function jsonResponse(body: unknown, ok = true): { ok: boolean; json: () => Promise<unknown> } {
  return { ok, json: () => Promise.resolve(body) };
}

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.resetModules();
    getVersionMock.mockReset();
    fetchMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(true);
    mockUserAgent('Mozilla/5.0 (Linux; Android 14)');
  });

  it('reports an update when the latest release tag is newer than the installed version', async () => {
    getVersionMock.mockResolvedValue('0.1.17');
    fetchMock.mockResolvedValue(
      jsonResponse({
        tag_name: 'v0.1.18',
        assets: [{ name: 'moto-routes-v0.1.18-arm64.apk', browser_download_url: 'https://example.com/apk' }],
      }),
    );

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({
      hasUpdate: true,
      latestVersion: '0.1.18',
      downloadUrl: 'https://example.com/apk',
    });
  });

  it('reports no update when the installed version already matches the latest release', async () => {
    getVersionMock.mockResolvedValue('0.1.17');
    fetchMock.mockResolvedValue(
      jsonResponse({
        tag_name: 'v0.1.17',
        assets: [{ name: 'moto-routes-v0.1.17-arm64.apk', browser_download_url: 'https://example.com/apk' }],
      }),
    );

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
  });

  it('does not check for updates outside Android/Tauri', async () => {
    isTauriMock.mockReturnValue(false);

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not check for updates on Tauri desktop (not Android)', async () => {
    isTauriMock.mockReturnValue(true);
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves to no update when there is no network connection', async () => {
    getVersionMock.mockResolvedValue('0.1.17');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
  });

  it('resolves to no update when the GitHub API responds with an error or rate limit', async () => {
    getVersionMock.mockResolvedValue('0.1.17');
    fetchMock.mockResolvedValue(jsonResponse({ message: 'API rate limit exceeded' }, false));

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
  });

  it('resolves to no update when the latest release has no APK asset', async () => {
    getVersionMock.mockResolvedValue('0.1.17');
    fetchMock.mockResolvedValue(jsonResponse({ tag_name: 'v0.1.18', assets: [] }));

    const { checkForUpdate } = await importService();
    const result = await checkForUpdate();

    expect(result).toEqual({ hasUpdate: false, latestVersion: null, downloadUrl: null });
  });
});
