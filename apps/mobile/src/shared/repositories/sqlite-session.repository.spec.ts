import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteSessionRepository, type SqlDb } from './sqlite-session.repository.js';
import { registerSessionRepositoryTests } from '../models/session.repository.spec.js';
import type { ISessionRepository } from '../models/session.repository.js';

/** Mock simple de SqlDb — mismo patrón que sqlite-profile.repository.spec.ts. */
function createMockDb(): SqlDb {
  let row: Record<string, unknown> | null = null;

  return {
    execute: vi.fn((sql: string, params?: unknown[]) => {
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('CREATE')) {
        return Promise.resolve({ rowsAffected: 0 });
      }
      if (upper.startsWith('INSERT OR REPLACE')) {
        row = {
          id: 1,
          token: params?.[0] ?? null,
          email: params?.[1] ?? null,
          refresh_token: params?.[2] ?? null,
          expires_at: params?.[3] ?? null,
        };
        return Promise.resolve({ rowsAffected: 1 });
      }
      if (upper.startsWith('DELETE')) {
        row = null;
        return Promise.resolve({ rowsAffected: 1 });
      }
      return Promise.resolve({ rowsAffected: 0 });
    }),
    select: vi.fn((sql: string) => {
      // PRAGMA table_info se usa para detectar columnas ya migradas — se
      // responde como si refresh_token/expires_at ya existieran, así el
      // mock no dispara ALTER TABLE de más en cada test.
      if (sql.trim().toUpperCase().startsWith('PRAGMA TABLE_INFO')) {
        return Promise.resolve([{ name: 'refresh_token' }, { name: 'expires_at' }]);
      }
      return Promise.resolve(row ? [row] : []);
    }),
  };
}

describe('SqliteSessionRepository', () => {
  let db: SqlDb;
  let repo: ISessionRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new SqliteSessionRepository(db);
  });

  registerSessionRepositoryTests(() => repo);

  it('should create the session table with a singleton CHECK(id = 1) constraint', async () => {
    await repo.get();

    const executeCalls = (db.execute as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]?][];
    const createCall = executeCalls.find(([sql]) => sql.toUpperCase().includes('CREATE TABLE'));
    expect(createCall![0]).toContain('CREATE TABLE IF NOT EXISTS session');
    expect(createCall![0]).toContain('CHECK (id = 1)');
  });

  it('should use INSERT OR REPLACE on save(), never a plain INSERT', async () => {
    await repo.save({ token: 'jwt-token', email: 'rider@example.com' });

    const executeCalls = (db.execute as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]?][];
    const insertCall = executeCalls.find(([sql]) => sql.toUpperCase().includes('INSERT'));
    expect(insertCall![0].toUpperCase()).toContain('INSERT OR REPLACE');
  });

  it('should DELETE the row on clear(), not just leave stale data', async () => {
    await repo.save({ token: 'jwt-token', email: 'rider@example.com' });

    await repo.clear();

    const executeCalls = (db.execute as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]?][];
    expect(executeCalls.some(([sql]) => sql.toUpperCase().startsWith('DELETE'))).toBe(true);
  });
});
