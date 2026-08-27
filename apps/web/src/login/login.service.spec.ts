import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, LoginError } from './login.service.js';
import { sessionStore } from '../shared/session/session.store.js';

describe('login()', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('credencial correcta: abre sesión y guarda el token en sessionStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [] }), { status: 200 })),
    );

    await login('token-correcto');

    expect(sessionStore.getToken()).toBe('token-correcto');
  });

  it('credencial correcta: llama a /admin/status con el token como Bearer', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ events: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await login('token-correcto');

    expect(fetchMock).toHaveBeenCalledWith(
      '/admin/status',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-correcto' }) as unknown }),
    );
  });

  it('credencial incorrecta (401): no guarda ningún token y lanza LoginError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    await expect(login('token-incorrecto')).rejects.toBeInstanceOf(LoginError);
    expect(sessionStore.getToken()).toBeNull();
  });

  it('fallo de red: no guarda ningún token y lanza el mismo LoginError genérico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    await expect(login('token-cualquiera')).rejects.toBeInstanceOf(LoginError);
    expect(sessionStore.getToken()).toBeNull();
  });
});
