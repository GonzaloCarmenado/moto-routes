import type { IStopTypesCacheRepository } from '../models/stop-types-cache.repository.js';
import type { StopCategory } from '../stop-types/stop-types.types.js';
import type { SqlDb } from './sqlite-route.repository.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS stop_types_cache (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL
  );
`;

interface StopCategoryRow {
  id: number;
  key: string;
  label: string;
  icon: string;
}

/**
 * Implementación de IStopTypesCacheRepository usando SQLite vía Tauri plugin.
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqliteStopTypesCacheRepository implements IStopTypesCacheRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly db: SqlDb) {}

  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.db.execute(SCHEMA).then(() => undefined);
    }
    return this.initPromise;
  }

  async replaceAll(types: StopCategory[]): Promise<void> {
    await this.ensureSchema();
    await this.db.execute('DELETE FROM stop_types_cache');

    for (const t of types) {
      await this.db.execute(
        'INSERT INTO stop_types_cache (id, key, label, icon) VALUES (?, ?, ?, ?)',
        [t.id, t.key, t.label, t.icon],
      );
    }
  }

  async getAll(): Promise<StopCategory[]> {
    await this.ensureSchema();
    const rows = await this.db.select('SELECT * FROM stop_types_cache ORDER BY id');
    return rows.map((r) => rowToStopCategory(r as unknown as StopCategoryRow));
  }
}

function rowToStopCategory(row: StopCategoryRow): StopCategory {
  return { id: row.id, key: row.key, label: row.label, icon: row.icon };
}
