import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, ExternalApiError } from './external-api.service.js';
import { MemorySessionRepository } from '../repositories/memory-session.repository.js';

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('devuelve el objeto parseado tal cual cuando fetch y response.json() resuelven', async () => {
    const payload = { foo: 'bar' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(payload) }),
    );

    const result = await fetchJson<typeof payload>('https://example.com/x');

    expect(result).toEqual(payload);
  });

  it('rechaza con ExternalApiError kind "network" si fetch rechaza por un fallo de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const promise = fetchJson('https://example.com/x');

    await expect(promise).rejects.toBeInstanceOf(ExternalApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });

  it('rechaza con ExternalApiError kind "invalid-json" si response.json() rechaza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error('unexpected token')) }),
    );

    const promise = fetchJson('https://example.com/x');

    await expect(promise).rejects.toBeInstanceOf(ExternalApiError);
    await expect(promise).rejects.toMatchObject({ kind: 'invalid-json' });
  });

  it('rechaza con ExternalApiError kind "timeout" y aborta la señal pasada a fetch si se supera timeoutMs', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchJson('https://example.com/x', { timeoutMs: 100 });
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(150);
    await assertion;

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('usa un timeout por defecto de 8000ms si no se especifica timeoutMs', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }));

    await fetchJson('https://example.com/x');

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000);
  });

  it('permite configurar timeoutMs por llamada', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }));

    await fetchJson('https://example.com/x', { timeoutMs: 3000 });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
  });

  it('limpia el temporizador de timeout sin fuga en caso de éxito', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }));

    await fetchJson('https://example.com/x');

    expect(vi.getTimerCount()).toBe(0);
  });

  it('limpia el temporizador de timeout sin fuga en caso de error de red', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchJson('https://example.com/x')).rejects.toMatchObject({ kind: 'network' });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('limpia el temporizador de timeout sin fuga en caso de JSON inválido', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error('unexpected token')) }),
    );

    await expect(fetchJson('https://example.com/x')).rejects.toMatchObject({ kind: 'invalid-json' });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('por defecto hace GET sin body ni Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchJson('https://example.com/x');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('con method POST y body, envía Content-Type application/json y el body serializado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJson<{ id: number }>('https://example.com/x', {
      method: 'POST',
      body: { email: 'rider@example.com' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'rider@example.com' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(result).toEqual({ id: 1 });
  });

  it('con checkStatus: true, rechaza con ExternalApiError kind "http-error" y el status/body cuando la respuesta no es ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({ error: 'email already registered' }) }),
    );

    const promise = fetchJson('https://example.com/x', { method: 'POST', body: {}, checkStatus: true });

    await expect(promise).rejects.toBeInstanceOf(ExternalApiError);
    await expect(promise).rejects.toMatchObject({
      kind: 'http-error',
      status: 409,
      body: { error: 'email already registered' },
    });
  });

  it('sin checkStatus, no comprueba response.ok (comportamiento existente sin cambios, p. ej. GET a APIs externas)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ foo: 'bar' }) }),
    );

    await expect(fetchJson('https://example.com/x')).resolves.toEqual({ foo: 'bar' });
  });

  it('con headers, los combina con Content-Type cuando hay body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchJson('https://example.com/x', {
      method: 'POST',
      body: { a: 1 },
      headers: { Authorization: 'Bearer jwt-token' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('con headers y sin body (GET autenticado), envía solo los headers indicados', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchJson('https://example.com/x', { headers: { Authorization: 'Bearer jwt-token' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-token');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('con method DELETE, no envía body ni Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchJson('https://example.com/x', { method: 'DELETE', headers: { Authorization: 'Bearer jwt-token' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('con body FormData, lo envía tal cual sin serializarlo a JSON ni fijar Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('photo', new Blob(['x']), 'photo.jpg');

    await fetchJson('https://example.com/x', { method: 'POST', body: formData });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(init.body).toBe(formData);
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('con status 204, resuelve a undefined sin llamar a response.json()', async () => {
    const jsonSpy = vi.fn().mockResolvedValue({ should: 'not be read' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: jsonSpy }));

    const result = await fetchJson('https://example.com/x', { method: 'DELETE' });

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('con Content-Length "0" y sin status 204, también resuelve a undefined sin llamar a response.json()', async () => {
    const jsonSpy = vi.fn().mockResolvedValue({ should: 'not be read' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? '0' : null) },
      json: jsonSpy,
    }));

    const result = await fetchJson('https://example.com/x');

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  describe('con sessionRefresh, en un 401 con checkStatus', () => {
    async function seedSession(): Promise<MemorySessionRepository> {
      const repo = new MemorySessionRepository();
      await repo.save({ token: 'jwt-old', email: 'rider@example.com', refreshToken: 'refresh-old', expiresAt: 1 });
      return repo;
    }

    it('renueva el access token y repite la petición original una vez, sin que el llamador vea el 401', async () => {
      const sessionRepository = await seedSession();
      const refresh = vi.fn().mockResolvedValue({ token: 'jwt-new', refreshToken: 'refresh-new', expiresIn: 1800 });
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'expired' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: 'ok' }) });
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchJson<{ data: string }>('https://example.com/x', {
        checkStatus: true,
        headers: { Authorization: 'Bearer jwt-old' },
        sessionRefresh: { sessionRepository, refresh },
      });

      expect(result).toEqual({ data: 'ok' });
      expect(refresh).toHaveBeenCalledWith('refresh-old');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect((secondInit.headers as Record<string, string>).Authorization).toBe('Bearer jwt-new');
    });

    it('persiste el access/refresh token nuevo en el repositorio de sesión', async () => {
      const sessionRepository = await seedSession();
      const refresh = vi.fn().mockResolvedValue({ token: 'jwt-new', refreshToken: 'refresh-new', expiresIn: 1800 });
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'expired' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) }));

      await fetchJson('https://example.com/x', {
        checkStatus: true,
        sessionRefresh: { sessionRepository, refresh },
      });

      await expect(sessionRepository.get()).resolves.toMatchObject({ token: 'jwt-new', refreshToken: 'refresh-new', email: 'rider@example.com' });
    });

    it('si la renovación también falla, limpia la sesión y deja propagar el 401 original', async () => {
      const sessionRepository = await seedSession();
      const refresh = vi.fn().mockRejectedValue(new ExternalApiError('http-error', 'invalid refresh token', 401));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ error: 'expired' }) }));

      const promise = fetchJson('https://example.com/x', {
        checkStatus: true,
        sessionRefresh: { sessionRepository, refresh },
      });

      await expect(promise).rejects.toMatchObject({ kind: 'http-error', status: 401 });
      await expect(sessionRepository.get()).resolves.toBeNull();
    });

    it('sin refreshToken guardado (sesión en formato viejo), no intenta renovar y deja propagar el 401', async () => {
      const sessionRepository = new MemorySessionRepository();
      await sessionRepository.save({ token: 'jwt-old', email: 'rider@example.com' });
      const refresh = vi.fn();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ error: 'expired' }) }));

      const promise = fetchJson('https://example.com/x', {
        checkStatus: true,
        sessionRefresh: { sessionRepository, refresh },
      });

      await expect(promise).rejects.toMatchObject({ kind: 'http-error', status: 401 });
      expect(refresh).not.toHaveBeenCalled();
    });

    it('en un error que no es 401, nunca intenta renovar', async () => {
      const sessionRepository = await seedSession();
      const refresh = vi.fn();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) }));

      const promise = fetchJson('https://example.com/x', {
        checkStatus: true,
        sessionRefresh: { sessionRepository, refresh },
      });

      await expect(promise).rejects.toMatchObject({ kind: 'http-error', status: 500 });
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
