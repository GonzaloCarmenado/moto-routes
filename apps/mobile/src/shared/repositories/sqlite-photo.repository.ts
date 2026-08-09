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
  remote_photo_id?: string | null;
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
    remotePhotoId: r.remote_photo_id ?? null,
  };
}

/**
 * Implementación de IPhotoRepository usando SQLite via Tauri plugin.
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqlitePhotoRepository implements IPhotoRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly db: SqlDb) {}

  // Memoiza la promesa (no un booleano) para que dos llamadas concurrentes
  // antes de que la primera termine vean la misma promesa en vez de ambas
  // ejecutar la migración -- mismo bug ya visto y corregido en
  // SqliteRouteRepository (ver su comentario, "duplicate column name").
  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runMigrations();
    }
    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    // Ver el mismo pragma en SqliteRouteRepository: `foreign_keys` es por conexión,
    // no por fichero, y esta clase abre su propia conexión al mismo moto-routes.db.
    await this.db.execute('PRAGMA foreign_keys = ON;');
    const statements = SCHEMA.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      await this.db.execute(stmt);
    }
    await this.ensureRemotePhotoIdColumn();
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` no migra una tabla `photos` que ya existía
   * antes de esta columna (mismo patrón que `preview_polyline` en
   * `SqliteRouteRepository`) -- se comprueba con `PRAGMA table_info` y solo
   * se ejecuta `ALTER TABLE` si hace falta.
   */
  private async ensureRemotePhotoIdColumn(): Promise<void> {
    const columns = await this.db.select('PRAGMA table_info(photos);');
    const hasColumn = columns.some((c) => c['name'] === 'remote_photo_id');
    if (!hasColumn) {
      await this.db.execute('ALTER TABLE photos ADD COLUMN remote_photo_id TEXT;');
    }
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

    return { id, createdAt, remotePhotoId: null, ...photo };
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

  async markPhotoSynced(photoId: string, remotePhotoId: string): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(`UPDATE photos SET remote_photo_id = ? WHERE id = ?`, [remotePhotoId, photoId]);
  }
}