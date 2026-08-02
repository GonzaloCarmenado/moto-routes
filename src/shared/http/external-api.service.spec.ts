import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, ExternalApiError } from './external-api.service.js';

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
});
