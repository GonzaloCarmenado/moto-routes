import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo, CreatePhoto } from '../models/photo.types.js';

/**
 * Interfaz mínima de base de datos SQL para abstraer Tauri del repositorio.
 * Permite mockear en tests unitarios sin depender de @tauri-apps/plugin-sql.
 */
export interface SqlDb {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  );
`;

interface PhotoRow {
  id: string;
  route_id: string;
  file_path: string;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  created_at: string;
}

function rowToPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    routeId: r.route_id,
    filePath: r.file_path,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    capturedAt: r.captured_at,
    createdAt: r.created_at,
  };
}

/**
 * Implementación de IPhotoRepository usando SQLite via Tauri plugin.
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqlitePhotoRepository implements IPhotoRepository {
  private initialized = false;

  constructor(private readonly db: SqlDb) {}

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;
    const statements = SCHEMA.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      await this.db.execute(stmt);
    }
    this.initialized = true;
  }

  async add(photo: CreatePhoto): Promise<Photo> {
    await this.ensureSchema();

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO photos (id, route_id, file_path, latitude, longitude, captured_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, photo.routeId, photo.filePath, photo.latitude, photo.longitude, photo.capturedAt, createdAt],
    );

    return { id, createdAt, ...photo };
  }

  async getById(id: string): Promise<Photo | null> {
    await this.ensureSchema();
    const rows = await this.db.select(`SELECT * FROM photos WHERE id = ?`, [id]);
    if (rows.length === 0) return null;
    return rowToPhoto(rows[0] as unknown as PhotoRow);
  }

  async getByRouteId(routeId: string): Promise<Photo[]> {
    await this.ensureSchema();
    const rows = await this.db.select(
      `SELECT * FROM photos WHERE route_id = ? ORDER BY captured_at DESC`,
      [routeId],
    );
    return rows.map((r) => rowToPhoto(r as unknown as PhotoRow));
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(`DELETE FROM photos WHERE id = ?`, [id]);
  }

  async countByRouteId(routeId: string): Promise<number> {
    await this.ensureSchema();
    const rows = await this.db.select(
      `SELECT COUNT(*) as count FROM photos WHERE route_id = ?`,
      [routeId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}