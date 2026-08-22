import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  registerAccount,
  loginAccount,
  requestPasswordReset,
  requestEmailVerification,
  fetchCurrentUser,
  setUsername,
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

  it('devuelve id/email/username en un registro correcto (201)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 1, email: 'rider@example.com', username: 'rider42' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery', 'rider42');

    expect(result).toEqual({ id: 1, email: 'rider@example.com', username: 'rider42' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'rider@example.com', password: 'correct-horse-battery', username: 'rider42' });
  });

  it('lanza AuthApiError kind "username-taken" en 409 con mensaje de username', async () => {
    stubFetch({ ok: false, status: 409, json: () => Promise.resolve({ error: 'username already taken' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery', 'rider42');

    await expect(promise).rejects.toMatchObject({ kind: 'username-taken' });
  });

  it('lanza AuthApiError kind "invalid-username" en 400 con mensaje de username', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid username' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery', 'ab');

    await expect(promise).rejects.toMatchObject({ kind: 'invalid-username' });
  });

  it('lanza AuthApiError kind "email-taken" en 409', async () => {
    stubFetch({ ok: false, status: 409, json: () => Promise.resolve({ error: 'email already registered' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery', 'rider42');

    await expect(promise).rejects.toBeInstanceOf(AuthApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'email-taken' });
  });

  it('lanza AuthApiError kind "weak-password" en 400 con mensaje de contraseña', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'password does not meet the minimum complexity policy' }),
    });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'short', 'rider42');

    await expect(promise).rejects.toMatchObject({ kind: 'weak-password' });
  });

  it('lanza AuthApiError kind "invalid-email" en 400 con mensaje de email', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid email' }) });

    const promise = registerAccount(BASE_URL, 'not-an-email', 'correct-horse-battery', 'rider42');

    await expect(promise).rejects.toMatchObject({ kind: 'invalid-email' });
  });

  it('lanza AuthApiError kind "rate-limited" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many registration attempts' }) });

    const promise = registerAccount(BASE_URL, 'rider@example.com', 'correct-horse-battery', 'rider42');

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

  it('devuelve el usuario actual, incluido el username, con un token válido (200)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, email: 'rider@example.com', email_verified: true, username: 'rider42' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCurrentUser(BASE_URL, 'jwt-token');

    expect(result).toEqual({ id: 1, email: 'rider@example.com', emailVerified: true, username: 'rider42' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
  });

  it('devuelve username null cuando la cuenta todavía no lo ha fijado', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, email: 'rider@example.com', email_verified: true, username: null }),
    });

    const result = await fetchCurrentUser(BASE_URL, 'jwt-token');

    expect(result.username).toBeNull();
  });

  it('lanza AuthApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = fetchCurrentUser(BASE_URL, 'expired-token');

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});

describe('setUsername', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía PATCH con el username y el Bearer del token; resuelve sin cuerpo en éxito (200)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(setUsername(BASE_URL, 'jwt-token', 'newname')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/auth/username`);
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'newname' });
  });

  it('lanza AuthApiError kind "username-taken" en 409', async () => {
    stubFetch({ ok: false, status: 409, json: () => Promise.resolve({ error: 'username already taken' }) });

    const promise = setUsername(BASE_URL, 'jwt-token', 'newname');

    await expect(promise).rejects.toMatchObject({ kind: 'username-taken' });
  });

  it('lanza AuthApiError kind "invalid-username" en 400', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ error: 'invalid username' }) });

    const promise = setUsername(BASE_URL, 'jwt-token', 'ab');

    await expect(promise).rejects.toMatchObject({ kind: 'invalid-username' });
  });

  it('lanza AuthApiError kind "unauthorized" en 401', async () => {
    stubFetch({ ok: false, status: 401, json: () => Promise.resolve({ error: 'missing or invalid token' }) });

    const promise = setUsername(BASE_URL, 'expired-token', 'newname');

    await expect(promise).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('lanza AuthApiError kind "rate-limited" en 429', async () => {
    stubFetch({ ok: false, status: 429, json: () => Promise.resolve({ error: 'too many attempts' }) });

    const promise = setUsername(BASE_URL, 'jwt-token', 'newname');

    await expect(promise).rejects.toMatchObject({ kind: 'rate-limited' });
  });
});
