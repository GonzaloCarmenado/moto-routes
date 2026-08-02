import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteProfileRepository, type SqlDb } from './sqlite-profile.repository.js';
import { registerProfileRepositoryTests } from '../models/profile.repository.spec.js';
import type { IProfileRepository } from '../models/profile.repository.js';

/**
 * Mock simple de SqlDb para tests de perfil.
 * El estado (fila única `id = 1`) vive en el mock, no en la instancia del
 * repositorio — a diferencia de MemoryProfileRepository, por lo que la
 * suite de contrato no necesita el patrón de dos niveles aquí: una única
 * instancia de SqliteProfileRepository comparte el mismo mockDb entre
 * llamadas dentro de un mismo test.
 */
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
          avatar_path: params?.[0] ?? null,
          name: params?.[1] ?? null,
          vehicle_type: params?.[2] ?? null,
          vehicle_make: params?.[3] ?? null,
          vehicle_model: params?.[4] ?? null,
        };
        return Promise.resolve({ rowsAffected: 1 });
      }
      return Promise.resolve({ rowsAffected: 0 });
    }),
    select: vi.fn((sql: string) => {
      const upper = sql.trim().toUpperCase();
      if (upper.includes('WHERE ID = 1')) {
        return Promise.resolve(row ? [row] : []);
      }
      return Promise.resolve(row ? [row] : []);
    }),
  };
}

describe('SqliteProfileRepository', () => {
  let db: SqlDb;
  let repo: IProfileRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new SqliteProfileRepository(db);
  });

  registerProfileRepositoryTests(() => repo);

  it('should create the profile table with a singleton CHECK(id = 1) constraint and no ALTER TABLE (fresh table, no migration needed)', async () => {
    await repo.get();

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS profile'),
    );
    const executeCalls = (db.execute as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]?][];
    const createCall = executeCalls.find(([sql]) => sql.toUpperCase().includes('CREATE TABLE'));
    expect(createCall![0]).toContain('CHECK (id = 1)');
    expect(createCall![0].toUpperCase()).not.toContain('ALTER TABLE');
  });

  it('should return null from get() on a freshly created table, without throwing (no rows yet)', async () => {
    await expect(repo.get()).resolves.toBeNull();
  });

  it('should use INSERT OR REPLACE on every save(), never a plain INSERT, so the second call never fails on a duplicate PRIMARY KEY', async () => {
    await repo.save({ name: 'Marc' });
    await repo.save({ name: 'Marc Updated' });

    const executeCalls = (db.execute as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]?][];
    const insertCalls = executeCalls.filter(([sql]) => sql.toUpperCase().includes('INSERT'));
    expect(insertCalls).toHaveLength(2);
    for (const [sql] of insertCalls) {
      expect(sql.toUpperCase()).toContain('INSERT OR REPLACE');
    }

    const fetched = await repo.get();
    expect(fetched!.name).toBe('Marc Updated');
  });
});
