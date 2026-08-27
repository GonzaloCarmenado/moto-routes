import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAdminStatus } from './reporting.service.js';
import { sessionStore } from '../shared/session/session.store.js';

describe('getAdminStatus()', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    sessionStore.setToken('token-de-sesion');
  });

  it('consulta /admin/status y devuelve el cuerpo tipado', async () => {
    const body = {
      events: [{ timestamp: '2026-08-26T10:00:00Z', level: 'error', message: 'algo falló' }],
      memory: { usedBytes: 100, totalBytes: 200 },
      disk: { usedBytes: 300, totalBytes: 400 },
      metricsTimestamp: '2026-08-26T10:00:00Z',
    };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await getAdminStatus();

    expect(result).toEqual(body);
  });

  it('sin memoria/disco todavía: la respuesta conserva events y omite el resto', async () => {
    const body = { events: [] };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const result = await getAdminStatus();

    expect(result.events).toEqual([]);
    expect(result.memory).toBeUndefined();
  });
});
