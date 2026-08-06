import type { SqlDb } from './sqlite-photo.repository.js';
import type { ISessionRepository } from '../models/session.repository.js';
import type { Session } from '../models/session.types.js';

export type { SqlDb };

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token TEXT NOT NULL,
    email TEXT NOT NULL
  );
`;

interface SessionRow {
  id: number;
  token: string;
  email: string;
}

/**
 * Implementación de ISessionRepository usando SQLite vía plugin Tauri.
 * La tabla `session` es de fila única (`id` fijo a `1`, `CHECK (id = 1)`),
 * mismo criterio que `profile` — un único dispositivo, sin multi-usuario.
 */
export class SqliteSessionRepository implements ISessionRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly db: SqlDb) {}

  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.db.execute(SCHEMA).then(() => undefined);
    }
    return this.initPromise;
  }

  async get(): Promise<Session | null> {
    await this.ensureSchema();
    const rows = await this.db.select('SELECT * FROM session WHERE id = 1');
    if (rows.length === 0) return null;
    const row = rows[0] as unknown as SessionRow;
    return { token: row.token, email: row.email };
  }

  async save(session: Session): Promise<void> {
    await this.ensureSchema();
    await this.db.execute('INSERT OR REPLACE INTO session (id, token, email) VALUES (1, ?, ?)', [
      session.token,
      session.email,
    ]);
  }

  async clear(): Promise<void> {
    await this.ensureSchema();
    await this.db.execute('DELETE FROM session WHERE id = 1');
  }
}
