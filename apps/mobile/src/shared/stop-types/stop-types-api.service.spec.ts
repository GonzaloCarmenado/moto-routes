import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchStopTypesFromApi } from './stop-types-api.service.js';

describe('fetchStopTypesFromApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the catalog from apps/api and returns it parsed', async () => {
    const catalog = [
      { id: 1, key: 'bar-restaurante', label: 'Bar / restaurante', icon: '🍽️' },
      { id: 2, key: 'mirador', label: 'Mirador', icon: '🏔️' },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(catalog),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStopTypesFromApi('http://localhost:8080');

    expect(result).toEqual(catalog);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/stop-types',
      expect.objectContaining({ signal: expect.anything() as AbortSignal }),
    );
  });

  it('propagates a typed error when the request fails (network down)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchStopTypesFromApi('http://localhost:8080')).rejects.toMatchObject({
      name: 'ExternalApiError',
      kind: 'network',
    });
  });
});
