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
  refresh_token: string | null;
  expires_at: number | null;
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
      this.initPromise = this.runMigrations();
    }
    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    await this.db.execute(SCHEMA);
    await this.ensureColumn('refresh_token', 'TEXT');
    await this.ensureColumn('expires_at', 'INTEGER');
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` no migra una tabla `session` que ya existía
   * antes de estas dos columnas (renovacion-token-sesion) — mismo gap que
   * `ensurePreviewPolylineColumn` en sqlite-route.repository.ts.
   */
  private async ensureColumn(name: string, sqlType: string): Promise<void> {
    const columns = await this.db.select('PRAGMA table_info(session);');
    const hasColumn = columns.some((c) => c['name'] === name);
    if (!hasColumn) {
      await this.db.execute(`ALTER TABLE session ADD COLUMN ${name} ${sqlType};`);
    }
  }

  async get(): Promise<Session | null> {
    await this.ensureSchema();
    const rows = await this.db.select('SELECT * FROM session WHERE id = 1');
    if (rows.length === 0) return null;
    const row = rows[0] as unknown as SessionRow;
    return {
      token: row.token,
      email: row.email,
      ...(row.refresh_token !== null ? { refreshToken: row.refresh_token } : {}),
      ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {}),
    };
  }

  async save(session: Session): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(
      'INSERT OR REPLACE INTO session (id, token, email, refresh_token, expires_at) VALUES (1, ?, ?, ?, ?)',
      [session.token, session.email, session.refreshToken ?? null, session.expiresAt ?? null],
    );
  }

  async clear(): Promise<void> {
    await this.ensureSchema();
    await this.db.execute('DELETE FROM session WHERE id = 1');
  }
}
