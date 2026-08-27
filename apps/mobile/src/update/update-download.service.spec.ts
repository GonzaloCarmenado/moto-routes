import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as UpdateDownloadModule from './update-download.service.js';

const fetchMock = vi.fn();
const appCacheDirMock = vi.fn();
const joinMock = vi.fn();
const existsMock = vi.fn();
const mkdirMock = vi.fn();
const writeFileMock = vi.fn();
const removeMock = vi.fn();
const renameMock = vi.fn();

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: fetchMock }));
vi.mock('@tauri-apps/api/path', () => ({ appCacheDir: appCacheDirMock, join: joinMock }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: existsMock,
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  remove: removeMock,
  rename: renameMock,
}));

async function importService(): Promise<typeof UpdateDownloadModule> {
  return import('./update-download.service.js');
}

/** Fabrica una Response con un body en streaming trocedo en `chunks`, mismo contrato que @tauri-apps/plugin-http. */
function streamedResponse(chunks: Uint8Array[], contentLength: string | null, ok = true, status = 200): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i]);
      i += 1;
    },
  });
  const headers = new Headers();
  if (contentLength) headers.set('content-length', contentLength);
  return new Response(body, { status, headers, statusText: ok ? 'OK' : 'Error' });
}

describe('downloadUpdate', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    appCacheDirMock.mockReset().mockResolvedValue('/cache');
    joinMock.mockReset().mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    existsMock.mockReset().mockResolvedValue(false);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    writeFileMock.mockReset().mockResolvedValue(undefined);
    removeMock.mockReset().mockResolvedValue(undefined);
    renameMock.mockReset().mockResolvedValue(undefined);
  });

  it('downloads only when explicitly invoked (no automatic side effects on import)', async () => {
    await importService();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads the APK, reports progress, writes it atomically and returns the final path', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5]);
    fetchMock.mockResolvedValue(streamedResponse([chunk1, chunk2], '5'));

    const onProgress = vi.fn();
    const { downloadUpdate } = await importService();
    const finalPath = await downloadUpdate({ downloadUrl: 'https://example.com/apk', onProgress });

    expect(mkdirMock).toHaveBeenCalledWith('/cache/updates', { recursive: true });
    expect(writeFileMock).toHaveBeenCalledOnce();
    const writtenBytes = writeFileMock.mock.calls[0]?.[1] as Uint8Array;
    expect(Array.from(writtenBytes)).toEqual([1, 2, 3, 4, 5]);
    expect(renameMock).toHaveBeenCalledWith('/cache/updates/update.apk.part', '/cache/updates/update.apk');
    expect(finalPath).toBe('/cache/updates/update.apk');
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 5 });
    expect(onProgress).toHaveBeenCalledWith({ loaded: 5, total: 5 });
  });

  it('reports progress with total null when the response has no content-length', async () => {
    fetchMock.mockResolvedValue(streamedResponse([new Uint8Array([9])], null));

    const onProgress = vi.fn();
    const { downloadUpdate } = await importService();
    await downloadUpdate({ downloadUrl: 'https://example.com/apk', onProgress });

    expect(onProgress).toHaveBeenCalledWith({ loaded: 1, total: null });
  });

  it('removes a leftover partial download from a previous failed attempt before starting', async () => {
    existsMock.mockImplementation((path: string) => Promise.resolve(path === '/cache/updates/update.apk.part'));
    fetchMock.mockResolvedValue(streamedResponse([new Uint8Array([1])], '1'));

    const { downloadUpdate } = await importService();
    await downloadUpdate({ downloadUrl: 'https://example.com/apk' });

    expect(removeMock).toHaveBeenCalledWith('/cache/updates/update.apk.part');
  });

  it('throws and never writes a file when the HTTP response is not ok', async () => {
    fetchMock.mockResolvedValue(streamedResponse([], '0', false, 500));

    const { downloadUpdate } = await importService();

    await expect(downloadUpdate({ downloadUrl: 'https://example.com/apk' })).rejects.toThrow();
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(renameMock).not.toHaveBeenCalled();
  });

  it('throws and never writes a file when the network fails mid-download', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { downloadUpdate } = await importService();

    await expect(downloadUpdate({ downloadUrl: 'https://example.com/apk' })).rejects.toThrow();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
