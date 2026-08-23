import { describe, it, expect, vi, afterEach } from 'vitest';
import { ensureFreshSession, buildSessionRefresh } from './session-refresh.service.js';
import { refreshSession } from './auth-api.service.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';
import type * as AuthApiService from './auth-api.service.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, refreshSession: vi.fn() };
});

const BASE_URL = 'http://localhost:8080';

describe('ensureFreshSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renueva y persiste la sesión si el access token ya expiró', async () => {
    vi.mocked(refreshSession).mockResolvedValue({ token: 'jwt-new', refreshToken: 'refresh-new', expiresIn: 1800 });
    const sessionRepository = new MemorySessionRepository();
    const expiredSession = { token: 'jwt-old', email: 'rider@example.com', refreshToken: 'refresh-old', expiresAt: Date.now() - 1000 };

    const result = await ensureFreshSession(BASE_URL, sessionRepository, expiredSession);

    expect(result.token).toBe('jwt-new');
    expect(refreshSession).toHaveBeenCalledWith(BASE_URL, 'refresh-old');
    await expect(sessionRepository.get()).resolves.toMatchObject({ token: 'jwt-new', refreshToken: 'refresh-new' });
  });

  it('no intenta renovar si el access token todavía es válido', async () => {
    const sessionRepository = new MemorySessionRepository();
    const validSession = { token: 'jwt-old', email: 'rider@example.com', refreshToken: 'refresh-old', expiresAt: Date.now() + 60000 };

    const result = await ensureFreshSession(BASE_URL, sessionRepository, validSession);

    expect(result).toBe(validSession);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('no intenta renovar una sesión en formato viejo sin refreshToken', async () => {
    const sessionRepository = new MemorySessionRepository();
    const oldFormatSession = { token: 'jwt-old', email: 'rider@example.com' };

    const result = await ensureFreshSession(BASE_URL, sessionRepository, oldFormatSession);

    expect(result).toBe(oldFormatSession);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('si la renovación falla, devuelve la sesión sin tocar y sin lanzar', async () => {
    vi.mocked(refreshSession).mockRejectedValue(new Error('network down'));
    const sessionRepository = new MemorySessionRepository();
    const expiredSession = { token: 'jwt-old', email: 'rider@example.com', refreshToken: 'refresh-old', expiresAt: Date.now() - 1000 };

    const result = await ensureFreshSession(BASE_URL, sessionRepository, expiredSession);

    expect(result).toBe(expiredSession);
  });
});

describe('buildSessionRefresh', () => {
  it('su refresh delega en refreshSession con el apiBaseUrl fijado', async () => {
    vi.mocked(refreshSession).mockResolvedValue({ token: 'jwt-new', refreshToken: 'refresh-new', expiresIn: 1800 });
    const sessionRepository = new MemorySessionRepository();

    const options = buildSessionRefresh(BASE_URL, sessionRepository);
    const result = await options.refresh('refresh-old');

    expect(refreshSession).toHaveBeenCalledWith(BASE_URL, 'refresh-old');
    expect(result).toEqual({ token: 'jwt-new', refreshToken: 'refresh-new', expiresIn: 1800 });
    expect(options.sessionRepository).toBe(sessionRepository);
  });
});
