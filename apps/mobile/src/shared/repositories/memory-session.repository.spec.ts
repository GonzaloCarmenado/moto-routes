import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySessionRepository } from './memory-session.repository.js';
import { registerSessionRepositoryTests } from '../models/session.repository.spec.js';
import type { ISessionRepository } from '../models/session.repository.js';

describe('MemorySessionRepository', () => {
  // Instancia nueva por test para aislamiento — mismo patrón que
  // memory-profile.repository.spec.ts.
  let repo: ISessionRepository;
  beforeEach(() => {
    repo = new MemorySessionRepository();
  });

  registerSessionRepositoryTests(() => repo);

  it('does not share state between different instances (isolation)', async () => {
    const repoA = new MemorySessionRepository();
    const repoB = new MemorySessionRepository();

    await repoA.save({ token: 'jwt-token', email: 'rider@example.com' });

    expect(await repoA.get()).not.toBeNull();
    expect(await repoB.get()).toBeNull();
  });
});
