import { describe, it, expect, beforeEach } from 'vitest';
import type { IProfileRepository } from '../models/profile.repository.js';
import { MemoryProfileRepository } from './memory-profile.repository.js';
import { registerProfileRepositoryTests } from '../models/profile.repository.spec.js';

describe('MemoryProfileRepository', () => {
  // La suite de contrato llama a getRepo() varias veces dentro de un mismo
  // `it` (p. ej. save() y luego get()) esperando que devuelva la misma
  // instancia — pero una instancia nueva por test, para aislamiento entre
  // tests. Mismo patrón de dos niveles que `createRouteSuite` usa para
  // IRouteRepository (route.repository.spec.ts).
  let repo: IProfileRepository;
  beforeEach(() => {
    repo = new MemoryProfileRepository();
  });

  registerProfileRepositoryTests(() => repo);

  it('does not share state between different instances (isolation)', async () => {
    const repoA = new MemoryProfileRepository();
    const repoB = new MemoryProfileRepository();

    await repoA.save({ name: 'Marc' });

    expect(await repoA.get()).not.toBeNull();
    expect(await repoB.get()).toBeNull();
  });
});
