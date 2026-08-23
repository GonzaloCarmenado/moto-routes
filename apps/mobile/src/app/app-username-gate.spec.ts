import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveUsernameGateSession } from './app-username-gate.js';
import { fetchCurrentUser } from '../auth/auth-api.service.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';
import type * as AuthApiService from '../auth/auth-api.service.js';

vi.mock('../auth/auth-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthApiService>();
  return { ...actual, fetchCurrentUser: vi.fn() };
});

const BASE_URL = 'http://localhost:8080';

describe('resolveUsernameGateSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve null sin sesión guardada', async () => {
    const sessionRepository = new MemorySessionRepository();

    const result = await resolveUsernameGateSession({ apiBaseUrl: BASE_URL, sessionRepository });

    expect(result).toBeNull();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('devuelve la sesión si la cuenta no tiene username fijado', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({ id: 1, email: 'rider@example.com', emailVerified: true, username: null });
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });

    const result = await resolveUsernameGateSession({ apiBaseUrl: BASE_URL, sessionRepository });

    expect(result?.token).toBe('jwt-token');
  });

  it('devuelve null si la cuenta ya tiene username fijado', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({ id: 1, email: 'rider@example.com', emailVerified: true, username: 'rider42' });
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });

    const result = await resolveUsernameGateSession({ apiBaseUrl: BASE_URL, sessionRepository });

    expect(result).toBeNull();
  });

  it('devuelve null (best-effort) si fetchCurrentUser falla, p. ej. sin conexión', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error('network down'));
    const sessionRepository = new MemorySessionRepository();
    await sessionRepository.save({ token: 'jwt-token', email: 'rider@example.com' });

    const result = await resolveUsernameGateSession({ apiBaseUrl: BASE_URL, sessionRepository });

    expect(result).toBeNull();
  });
});
