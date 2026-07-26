import { describe, it, expect, vi, afterEach } from 'vitest';

const writeFileMock = vi.fn().mockResolvedValue(undefined);
const readFileMock = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const existsMock = vi.fn().mockResolvedValue(false);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
const removeMock = vi.fn().mockResolvedValue(undefined);
const appDataDirMock = vi.fn().mockResolvedValue('/data/data/com.motoroutes.app/files');
const joinMock = vi.fn((...parts: string[]) => Promise.resolve(parts.join('/')));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: writeFileMock,
  readFile: readFileMock,
  exists: existsMock,
  mkdir: mkdirMock,
  remove: removeMock,
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: appDataDirMock,
  join: joinMock,
}));

import { savePhotoFile, getPhotoUrl, deletePhotoFile, createPhotoRepository } from './photo-storage.service.js';

/**
 * jsdom's File/Blob polyfill doesn't implement arrayBuffer() — patch it in for these tests.
 */
function makeFile(name: string): File {
  const file = new File(['fake-image'], name, { type: 'image/jpeg' });
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode('fake-image').buffer),
    });
  }
  return file;
}

function setTauri(active: boolean): void {
  if (active) {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  }
}

describe('savePhotoFile', () => {
  afterEach(() => {
    setTauri(false);
    vi.clearAllMocks();
  });

  it('returns a base64 data URL in browser (persists across reloads, unlike blob:)', async () => {
    const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await savePhotoFile(file);
    expect(result).toMatch(/^data:/);
  });

  it('writes the file under appDataDir/photos using a real path join (no missing separator)', async () => {
    setTauri(true);
    const file = makeFile('photo.jpg');
    const result = await savePhotoFile(file);

    expect(appDataDirMock).toHaveBeenCalled();
    expect(joinMock).toHaveBeenCalledWith('/data/data/com.motoroutes.app/files', 'photos');
    expect(writeFileMock).toHaveBeenCalledTimes(1);

    const [writtenPath, writtenBytes] = writeFileMock.mock.calls[0] as [string, Uint8Array];
    expect(writtenPath).toBe(result);
    expect(writtenPath).toContain('/photos/');
    expect(writtenPath.endsWith('.jpg')).toBe(true);
    expect(writtenBytes).toBeInstanceOf(Uint8Array);
  });

  it('does not recreate the photos directory when it already exists', async () => {
    setTauri(true);
    existsMock.mockResolvedValueOnce(true);
    await savePhotoFile(makeFile('a.jpg'));
    expect(mkdirMock).not.toHaveBeenCalled();
  });

  it('creates the photos directory when missing', async () => {
    setTauri(true);
    existsMock.mockResolvedValueOnce(false);
    await savePhotoFile(makeFile('a.jpg'));
    expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining('photos'), { recursive: true });
  });
});

describe('getPhotoUrl', () => {
  afterEach(() => {
    setTauri(false);
    vi.clearAllMocks();
  });

  it('passes through blob: URLs unchanged', async () => {
    await expect(getPhotoUrl('blob:http://localhost/abc')).resolves.toBe('blob:http://localhost/abc');
  });

  it('passes through data: URLs unchanged', async () => {
    const dataUrl = 'data:image/jpeg;base64,AAAA';
    await expect(getPhotoUrl(dataUrl)).resolves.toBe(dataUrl);
  });

  it('passes through placeholder paths (photos/...) unchanged', async () => {
    await expect(getPhotoUrl('photos/uuid-name.jpg')).resolves.toBe('photos/uuid-name.jpg');
  });

  it('reads the file via plugin-fs and returns a blob: object URL when running in Tauri', async () => {
    setTauri(true);
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-photo-url');
    vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL: createObjectURLMock }));

    const stored = '/data/data/com.motoroutes.app/photos/abc.jpg';
    const result = await getPhotoUrl(stored);

    expect(readFileMock).toHaveBeenCalledWith(stored);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const [blobArg] = createObjectURLMock.mock.calls[0] as [Blob];
    expect(blobArg.type).toBe('image/jpeg');
    expect(result).toBe('blob:mock-photo-url');

    vi.unstubAllGlobals();
  });

  it('does not touch plugin-fs outside Tauri', async () => {
    const result = await getPhotoUrl('/some/path.jpg');
    expect(result).toBe('/some/path.jpg');
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

describe('deletePhotoFile', () => {
  afterEach(() => {
    setTauri(false);
    vi.clearAllMocks();
  });

  it('is a safe no-op in browser (nothing on disk to delete — the data lives in the DB row)', async () => {
    await expect(deletePhotoFile('data:image/jpeg;base64,AAAA')).resolves.toBeUndefined();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('removes the file via plugin-fs when running in Tauri', async () => {
    setTauri(true);
    await deletePhotoFile('/data/data/com.motoroutes.app/files/photos/abc.jpg');
    expect(removeMock).toHaveBeenCalledWith('/data/data/com.motoroutes.app/files/photos/abc.jpg');
  });

  it('does not throw if the file is already missing (delete is best-effort)', async () => {
    setTauri(true);
    removeMock.mockRejectedValueOnce(new Error('file not found'));
    await expect(deletePhotoFile('/missing.jpg')).resolves.toBeUndefined();
  });
});

describe('createPhotoRepository', () => {
  afterEach(() => {
    setTauri(false);
  });

  it('returns a MemoryPhotoRepository outside Tauri', async () => {
    const repo = await createPhotoRepository();
    expect(repo.constructor.name).toBe('MemoryPhotoRepository');
  });
});
