import { it, expect } from 'vitest';
import type { ISessionRepository } from './session.repository.js';

/**
 * Tests de contrato para ISessionRepository — mismo patrón que
 * `profile.repository.spec.ts`: el caller envuelve esta función en su
 * `describe()` (`memory-session.repository.spec.ts`/`sqlite-session.repository.spec.ts`).
 */
export function registerSessionRepositoryTests(getRepo: () => ISessionRepository): void {
  it('should return null from get() on a freshly created repository', async () => {
    await expect(getRepo().get()).resolves.toBeNull();
  });

  it('should persist and retrieve the session after save()', async () => {
    await getRepo().save({ token: 'jwt-token', email: 'rider@example.com' });

    await expect(getRepo().get()).resolves.toEqual({ token: 'jwt-token', email: 'rider@example.com' });
  });

  it('should replace the whole session on a second save(), never mixing fields', async () => {
    await getRepo().save({ token: 'jwt-token-1', email: 'rider@example.com' });
    await getRepo().save({ token: 'jwt-token-2', email: 'other@example.com' });

    await expect(getRepo().get()).resolves.toEqual({ token: 'jwt-token-2', email: 'other@example.com' });
  });

  it('should return null from get() after clear()', async () => {
    await getRepo().save({ token: 'jwt-token', email: 'rider@example.com' });

    await getRepo().clear();

    await expect(getRepo().get()).resolves.toBeNull();
  });

  it('should not throw when clear() is called with no session saved', async () => {
    await expect(getRepo().clear()).resolves.toBeUndefined();
  });

  it('should persist and retrieve refreshToken and expiresAt alongside the rest of the session', async () => {
    await getRepo().save({ token: 'jwt-token', email: 'rider@example.com', refreshToken: 'refresh-abc', expiresAt: 1700000000000 });

    await expect(getRepo().get()).resolves.toEqual({
      token: 'jwt-token',
      email: 'rider@example.com',
      refreshToken: 'refresh-abc',
      expiresAt: 1700000000000,
    });
  });
}
