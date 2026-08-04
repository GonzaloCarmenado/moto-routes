import { describe, it, expect, vi } from 'vitest';
import { refreshStopTypesCache } from './stop-types.service.js';
import { MemoryStopTypesCacheRepository } from '../repositories/memory-stop-types-cache.repository.js';
import type { StopCategory } from './stop-types.types.js';

const freshCatalog: StopCategory[] = [
  { id: 1, key: 'bar-restaurante', label: 'Bar / restaurante', icon: '🍽️' },
];

describe('refreshStopTypesCache', () => {
  it('updates the cache when the API request succeeds', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    const fetchFromApi = vi.fn().mockResolvedValue(freshCatalog);

    await refreshStopTypesCache({ cache, fetchFromApi, apiBaseUrl: 'http://localhost:8080' });

    expect(await cache.getAll()).toEqual(freshCatalog);
    expect(fetchFromApi).toHaveBeenCalledWith('http://localhost:8080');
  });

  it('leaves the existing cache untouched when the API request fails', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    await cache.replaceAll(freshCatalog);
    const fetchFromApi = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      refreshStopTypesCache({ cache, fetchFromApi, apiBaseUrl: 'http://localhost:8080' }),
    ).resolves.toBeUndefined();

    expect(await cache.getAll()).toEqual(freshCatalog);
  });

  it('resolves without throwing when there is no cache and the API request fails', async () => {
    const cache = new MemoryStopTypesCacheRepository();
    const fetchFromApi = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      refreshStopTypesCache({ cache, fetchFromApi, apiBaseUrl: 'http://localhost:8080' }),
    ).resolves.toBeUndefined();

    expect(await cache.getAll()).toEqual([]);
  });
});
