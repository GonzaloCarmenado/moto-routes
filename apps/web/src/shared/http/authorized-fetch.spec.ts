import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authorizedFetch } from './authorized-fetch.js';
import { sessionStore } from '../session/session.store.js';
import { SESSION_INVALIDATED_EVENT } from '../session/session-events.js';

describe('authorizedFetch()', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('adjunta el token de sesión como Bearer', async () => {
    sessionStore.setToken('token-de-sesion');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"events":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authorizedFetch('/admin/status');

    expect(fetchMock).toHaveBeenCalledWith(
      '/admin/status',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-de-sesion' }) as unknown }),
    );
  });

  it('una respuesta 401 invalida la sesión local y despacha session-invalidated', async () => {
    sessionStore.setToken('token-caducado');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const onInvalidated = vi.fn();
    window.addEventListener(SESSION_INVALIDATED_EVENT, onInvalidated);

    await expect(authorizedFetch('/admin/status')).rejects.toThrow();

    expect(sessionStore.getToken()).toBeNull();
    expect(onInvalidated).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_INVALIDATED_EVENT, onInvalidated);
  });

  it('un fallo de red no toca la sesión ni despacha session-invalidated', async () => {
    sessionStore.setToken('token-de-sesion');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const onInvalidated = vi.fn();
    window.addEventListener(SESSION_INVALIDATED_EVENT, onInvalidated);

    await expect(authorizedFetch('/admin/status')).rejects.toThrow();

    expect(sessionStore.getToken()).toBe('token-de-sesion');
    expect(onInvalidated).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_INVALIDATED_EVENT, onInvalidated);
  });
});
