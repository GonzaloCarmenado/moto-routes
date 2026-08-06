import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  registerAccount,
  loginAccount,
  requestPasswordReset,
  requestEmailVerification,
  fetchCurrentUser,
  AuthApiError,
} from './auth-api.service.js';

const BASE_URL = 'http://localhost:8080';

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('registerAccount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve id/email en un registro correcto (201)', async () => {
    stubFetch({ ok: true, status: 201, json: () => Promise.resolve({ id: 1, email: 'rider@example.com' }) });

    const result = await registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery');

    expect(result).toEqual({ id: 1, email: 'rider@example.com' });
  });

  it('lanza AuthApiError kind "email-taken" en 409', async () => {
    stubFetch({ ok: false, status: 409, json: () => Promise.resolve({ error: 'email already registered' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery');

    await expect(promise).rejects.toBeInstanceOf(AuthApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'email-taken' });
  });

  it('lanza AuthApiError kind "weak-password" en 400 con mensaje de contraseña', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'password does not meet the minimum complexity policy' }),
    });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'short');

    await expect(promise).rejects.toMatchObject({ kind: 'weak-password' });
  });

  it('lanza AuthApiError kind "invalid-email" en 400 con mensaje de email', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid email' }) });

    const promise = registerAccount(BASE_URL, 'not-an-email', 'correct-horse-battery');

    await expect(promise).rejects.toMatchObject({ kind: 'invalid-email' });
  });

  it('lanza AuthApiError kind "rate-limited" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many registration attempts' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery');

    await expect(promise).rejects.toMatchObject({ kind: 'rate-limited' });
  });
});

describe('loginAccount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el token en un login correcto (200)', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ token: 'jwt-token' }) });

    const result = await loginAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery');

    expect(result).toEqual({ token: 'jwt-token' });
  });

  it('lanza AuthApiError kind "invalid-credentials" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'invalid email or password' }) });

    const promise = loginAccount(BASE_URL, 'rider@example.com', 'wrong-password');

    await expect(promise).rejects.toMatchObject({ kind: 'invalid-credentials' });
  });

  it('lanza AuthApiError kind "email-not-verified" en 403', async () => {
    stubFetch({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'email not verified, check your inbox for the verification link' }),
    });

    const promise = loginAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery');

    await expect(promise).rejects.toMatchObject({ kind: 'email-not-verified' });
  });

  it('lanza AuthApiError kind "rate-limited" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many failed login attempts' }) });

    const promise = loginAccount(BASE_URL, 'rider@example.com', 'wrong-password');

    await expect(promise).rejects.toMatchObject({ kind: 'rate-limited' });
  });
});

describe('requestPasswordReset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve en éxito genérico (200), exista o no la cuenta', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'if an account exists for this email, a password reset email has been sent' }),
    });

    await expect(requestPasswordReset(BASE_URL, 'anyone@example.com')).resolves.toBeUndefined();
  });
});

describe('requestEmailVerification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve en éxito genérico (200)', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'if an account exists for this email, a verification email has been sent' }),
    });

    await expect(requestEmailVerification(BASE_URL, 'rider@example.com')).resolves.toBeUndefined();
  });
});

describe('fetchCurrentUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el usuario actual con un token válido (200)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, email: 'rider@example.com', email_verified: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCurrentUser(BASE_URL, 'jwt-token');

    expect(result).toEqual({ id: 1, email: 'rider@example.com', emailVerified: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
  });

  it('lanza AuthApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = fetchCurrentUser(BASE_URL, 'expired-token');

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
