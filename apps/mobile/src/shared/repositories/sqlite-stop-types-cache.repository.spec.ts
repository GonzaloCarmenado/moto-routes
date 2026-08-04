import { SqliteStopTypesCacheRepository } from './sqlite-stop-types-cache.repository.js';
import { createStopTypesCacheSuite } from '../models/stop-types-cache.repository.spec.js';
import type { SqlDb } from './sqlite-route.repository.js';

/** Mock mínimo de SqlDb: una sola tabla, suficiente para este repositorio simple. */
function createMockDb(): SqlDb {
  let rows: Record<string, unknown>[] = [];

  return {
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
      if (sql.startsWith('CREATE TABLE')) {
        return Promise.resolve({ rowsAffected: 0 });
      }
      if (sql.startsWith('DELETE')) {
        rows = [];
        return Promise.resolve({ rowsAffected: 0 });
      }
      if (sql.startsWith('INSERT')) {
        const [id, key, label, icon] = params!;
        rows.push({ id, key, label, icon });
        return Promise.resolve({ rowsAffected: 1 });
      }
      return Promise.resolve({ rowsAffected: 0 });
    },
    select(): Promise<Record<string, unknown>[]> {
      return Promise.resolve([...rows].sort((a, b) => (a['id'] as number) - (b['id'] as number)));
    },
  };
}

createStopTypesCacheSuite('SqliteStopTypesCacheRepository', () => new SqliteStopTypesCacheRepository(createMockDb()));
