import { describe, it, expect, beforeEach } from 'vitest';
import type { IStopTypesCacheRepository } from './stop-types-cache.repository.js';
import type { StopCategory } from '../stop-types/stop-types.types.js';

/**
 * Tests de contrato para IStopTypesCacheRepository.
 * Se ejecutan contra cualquier implementación que cumpla la interfaz.
 */

const sampleTypes: StopCategory[] = [
  { id: 1, key: 'bar-restaurante', label: 'Bar / restaurante', icon: '🍽️' },
  { id: 2, key: 'mirador', label: 'Mirador', icon: '🏔️' },
];

function registerCacheTests(getRepo: () => IStopTypesCacheRepository): void {
  it('returns an empty list when there is no cache yet', async () => {
    const all = await getRepo().getAll();

    expect(all).toEqual([]);
  });

  it('returns the cached catalog after replaceAll', async () => {
    await getRepo().replaceAll(sampleTypes);

    const all = await getRepo().getAll();

    expect(all).toEqual(sampleTypes);
  });

  it('replaceAll fully replaces the previous cache, not merges it', async () => {
    await getRepo().replaceAll(sampleTypes);
    const updated: StopCategory[] = [{ id: 3, key: 'gasolinera', label: 'Gasolinera', icon: '⛽' }];

    await getRepo().replaceAll(updated);
    const all = await getRepo().getAll();

    expect(all).toEqual(updated);
  });
}

export function createStopTypesCacheSuite(name: string, factory: () => IStopTypesCacheRepository): void {
  describe(name, () => {
    let repo: IStopTypesCacheRepository;
    const getRepo = (): IStopTypesCacheRepository => repo;

    beforeEach(() => {
      repo = factory();
    });

    registerCacheTests(getRepo);
  });
}
