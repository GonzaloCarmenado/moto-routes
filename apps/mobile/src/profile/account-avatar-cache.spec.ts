import { describe, it, expect, vi, afterEach } from 'vitest';

const { writeFileMock, existsMock, mkdirMock, appDataDirMock, joinMock, fetchAccountAvatarMock } = vi.hoisted(() => ({
  writeFileMock: vi.fn().mockResolvedValue(undefined),
  existsMock: vi.fn().mockResolvedValue(true),
  mkdirMock: vi.fn().mockResolvedValue(undefined),
  appDataDirMock: vi.fn().mockResolvedValue('/data/data/com.motoroutes.app/files'),
  joinMock: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
  fetchAccountAvatarMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: writeFileMock, exists: existsMock, mkdir: mkdirMock }));
vi.mock('@tauri-apps/api/path', () => ({ appDataDir: appDataDirMock, join: joinMock }));
vi.mock('../shared/http/avatar-api.service.js', () => ({
  fetchAccountAvatar: fetchAccountAvatarMock,
}));

class FakeAvatarApiError extends Error {
  constructor(public readonly kind: string) {
    super(kind);
  }
}

import { resolveAccountAvatarUrl } from './account-avatar-cache.js';

const BASE_URL = 'http://localhost:8080';
const TOKEN = 'jwt-token';

function setTauri(active: boolean): void {
  if (active) {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  }
}

describe('resolveAccountAvatarUrl', () => {
  afterEach(() => {
    setTauri(false);
    vi.clearAllMocks();
  });

  it('arranque en frío / login: con avatar configurado, lo descarga y devuelve una URL utilizable (4.1, 4.2)', async () => {
    setTauri(false);
    const blob = new Blob(['png bytes'], { type: 'application/octet-stream' });
    fetchAccountAvatarMock.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:account-avatar');

    const result = await resolveAccountAvatarUrl(BASE_URL, TOKEN);

    expect(fetchAccountAvatarMock).toHaveBeenCalledWith(BASE_URL, TOKEN);
    expect(result).toBe('blob:account-avatar');
  });

  it('en Tauri, cachea los bytes bajo appDataDir/photos (mismo scope de capacidades ya concedido a fotos) antes de devolver la URL (4.5)', async () => {
    setTauri(true);
    existsMock.mockResolvedValue(true);
    const blob = new Blob(['png bytes'], { type: 'application/octet-stream' });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode('png bytes').buffer),
    });
    fetchAccountAvatarMock.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:account-avatar');

    const result = await resolveAccountAvatarUrl(BASE_URL, TOKEN);

    expect(writeFileMock).toHaveBeenCalledWith(
      '/data/data/com.motoroutes.app/files/photos/account-avatar.bin',
      expect.any(Uint8Array),
    );
    expect(mkdirMock).not.toHaveBeenCalled();
    expect(result).toBe('blob:account-avatar');
  });

  it('en Tauri, crea el directorio photos/ si todavía no existe antes de escribir', async () => {
    setTauri(true);
    existsMock.mockResolvedValue(false);
    const blob = new Blob(['png bytes'], { type: 'application/octet-stream' });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode('png bytes').buffer),
    });
    fetchAccountAvatarMock.mockResolvedValue(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:account-avatar');

    await resolveAccountAvatarUrl(BASE_URL, TOKEN);

    expect(mkdirMock).toHaveBeenCalledWith('/data/data/com.motoroutes.app/files/photos', { recursive: true });
    expect(writeFileMock).toHaveBeenCalled();
  });

  it('cuenta sin avatar configurado (404) devuelve null sin lanzar (4.3)', async () => {
    fetchAccountAvatarMock.mockRejectedValue(new FakeAvatarApiError('not-found'));

    const result = await resolveAccountAvatarUrl(BASE_URL, TOKEN);

    expect(result).toBeNull();
  });

  it('un fallo de red al descargar no lanza y devuelve null, sin bloquear el resto de Perfil (4.4)', async () => {
    fetchAccountAvatarMock.mockRejectedValue(new FakeAvatarApiError('network'));

    await expect(resolveAccountAvatarUrl(BASE_URL, TOKEN)).resolves.toBeNull();
  });
});
