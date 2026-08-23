import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadAuthSectionState } from './auth-section.service.js';
import { fetchCurrentUser, AuthApiError } from './auth-api.service.js';
import type * as AuthApiService from './auth-api.service.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';

vi.mock('./auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, fetchCurrentUser: vi.fn() };
});

describe('loadAuthSectionState', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión guardada, devuelve logged-out sin llamar a fetchCurrentUser', async () => {
    const sessionRepository = new MemorySessionRepository();

    const state = await loadAuthSectionState('http://localhost:8080', sessionRepository);

    expect(state).toEqual({ status: 'logged-out' });
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('con sesión guardada y válida, devuelve logged-in con el email confirmado por /me', async () => {
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'stale@example.com' });
    vi.mocked(fetchCurrentUser).mockResolvedValue({ id: 1, email: 'rider@example.com', emailVerified: true, username: 'rider42' });

    const state = await loadAuthSectionState('http://localhost:8080', sessionRepository);

    expect(state).toEqual({ status: 'logged-in', email: 'rider@example.com', username: 'rider42' });
    expect(fetchCurrentUser).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', expect.objectContaining({ sessionRepository }));
  });

  it('con sesión guardada y válida pero sin username fijado, devuelve logged-in con username null', async () => {
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });
    vi.mocked(fetchCurrentUser).mockResolvedValue({ id: 1, email: 'rider@example.com', emailVerified: true, username: null });

    const state = await loadAuthSectionState('http://localhost:8080', sessionRepository);

    expect(state).toEqual({ status: 'logged-in', email: 'rider@example.com', username: null });
  });

  it('con sesión guardada pero ya no válida (401), borra la sesión local y devuelve logged-out', async () => {
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'expired-token', email: 'rider@example.com' });
    vi.mocked(fetchCurrentUser).mockRejectedValue(new AuthApiError('unauthorized', 'missing or invalid token'));

    const state = await loadAuthSectionState('http://localhost:8080', sessionRepository);

    expect(state).toEqual({ status: 'logged-out' });
    await expect(sessionRepository.get()).resolves.toBeNull();
  });

  it('ante un fallo de red (no 401), mantiene la sesión guardada en caché en vez de cerrar sesión', async () => {
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });
    vi.mocked(fetchCurrentUser).mockRejectedValue(new AuthApiError('network', 'network down'));

    const state = await loadAuthSectionState('http://localhost:8080', sessionRepository);

    expect(state).toEqual({ status: 'logged-in', email: 'rider@example.com', username: null });
    await expect(sessionRepository.get()).resolves.not.toBeNull();
  });
});
