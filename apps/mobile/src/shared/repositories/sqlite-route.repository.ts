import type { IRouteRepository } from '../models/route.repository.js';
import type {
  Route,
  RoutePoint,
  RouteStop,
  CreateRoute,
  CreateRoutePoint,
  CreateRouteStop,
} from '../models/route.types.js';

/**
 * Interfaz mínima de base de datos SQL para abstraer Tauri del repositorio.
 * Permite mockear en tests unitarios sin depender de @tauri-apps/plugin-sql.
 */
export interface SqlDb {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    duration REAL NOT NULL,
    total_distance REAL NOT NULL,
    avg_speed REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    visibility TEXT NOT NULL DEFAULT 'private',
    origin TEXT NOT NULL DEFAULT 'local'
  );

  CREATE TABLE IF NOT EXISTS route_points (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    alt REAL NOT NULL DEFAULT 0,
    speed REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS route_stops (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'auto',
    stop_type_id INTEGER,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  );
`;

/**
 * Implementación de IRouteRepository usando SQLite via Tauri plugin.
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqliteRouteRepository implements IRouteRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly db: SqlDb) {}

  // Memoiza la propia promesa (no un booleano) para que llamadas concurrentes
  // a ensureSchema() —route-list, route-detail y profile-view comparten la
  // misma instancia de repositorio y cada una la dispara en su propio mount—
  // esperen la misma migración en curso en vez de lanzar cada una la suya:
  // con un booleano puesto a `true` solo al final, dos llamadas que entran
  // antes de que la primera termine ven `initialized === false` a la vez y
  // ambas ejecutan `ensurePreviewPolylineColumn()`/`ensureColumn()`, la
  // segunda fallando con "duplicate column name" al hacer el mismo
  // `ALTER TABLE` dos veces (bug real, visto en dispositivo).
  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runMigrations();
    }
    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    // SQLite tiene `foreign_keys` en OFF por defecto (por conexión, no por fichero):
    // sin esto, el ON DELETE CASCADE de route_points/route_stops/photos no se
    // aplica y delete() dejaría huérfanos. Debe ejecutarse antes de cualquier DELETE.
    await this.db.execute('PRAGMA foreign_keys = ON;');
    const statements = SCHEMA.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      await this.db.execute(stmt);
    }
    await this.ensurePreviewPolylineColumn();
    await this.ensureColumn('name', 'TEXT');
    await this.ensureColumn('notes', 'TEXT');
    await this.ensureColumn('is_favorite', 'INTEGER');
    await this.ensureStopTypeIdColumn();
  }

  /**
   * Mismo gap que `ensurePreviewPolylineColumn`: `CREATE TABLE IF NOT EXISTS`
   * no migra una tabla `route_stops` que ya existía antes de esta columna.
   */
  private async ensureStopTypeIdColumn(): Promise<void> {
    const columns = await this.db.select('PRAGMA table_info(route_stops);');
    const hasColumn = columns.some((c) => c['name'] === 'stop_type_id');
    if (!hasColumn) {
      await this.db.execute('ALTER TABLE route_stops ADD COLUMN stop_type_id INTEGER;');
    }
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` no migra una tabla que ya existía antes de esta
   * columna (mismo tipo de gap que el `PRAGMA foreign_keys` de ADR-023) — se
   * comprueba con `PRAGMA table_info` y solo se ejecuta `ALTER TABLE` si hace falta.
   */
  private async ensurePreviewPolylineColumn(): Promise<void> {
    const columns = await this.db.select('PRAGMA table_info(routes);');
    const hasColumn = columns.some((c) => c['name'] === 'preview_polyline');
    if (!hasColumn) {
      await this.db.execute('ALTER TABLE routes ADD COLUMN preview_polyline TEXT;');
    }
  }

  /** Mismo patrón que `ensurePreviewPolylineColumn`, generalizado para `name`/`notes`. */
  private async ensureColumn(name: string, sqlType: string): Promise<void> {
    const columns = await this.db.select('PRAGMA table_info(routes);');
    const hasColumn = columns.some((c) => c['name'] === name);
    if (!hasColumn) {
      await this.db.execute(`ALTER TABLE routes ADD COLUMN ${name} ${sqlType};`);
    }
  }

  async save(
    route: CreateRoute,
    points: CreateRoutePoint[],
    stops: CreateRouteStop[],
  ): Promise<Route> {
    await this.ensureSchema();

    const id = route.id ?? crypto.randomUUID();
    // Upsert por id: la grabación inserta una fila 'active' nada más empezar (para que
    // las fotos capturadas en pleno directo tengan una ruta padre a la que referenciar
    // vía FOREIGN KEY) y la actualiza al parar, en vez de duplicarla.
    const existing = await this.getById(id);
    const createdAt = existing?.createdAt ?? new Date().toISOString();

    // Coalescido con el valor ya existente: name puede omitirse en llamadas intermedias
    // (ej. la fila 'active' insertada al empezar a grabar) sin perder el nombre asignado
    // en un save() posterior si, por lo que fuera, se volviera a omitir.
    const name = route.name ?? existing?.name ?? null;

    if (existing) {
      await this.db.execute(
        `UPDATE routes SET duration = ?, total_distance = ?, avg_speed = ?, status = ?, visibility = ?, origin = ?, name = ? WHERE id = ?`,
        [route.duration, route.totalDistance, route.avgSpeed, route.status, route.visibility, route.origin, name, id],
      );
    } else {
      await this.db.execute(
        `INSERT INTO routes (id, created_at, duration, total_distance, avg_speed, status, visibility, origin, name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, createdAt, route.duration, route.totalDistance, route.avgSpeed, route.status, route.visibility, route.origin, name],
      );
    }

    if (points.length > 0) {
      const placeholders = points.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values: unknown[] = [];
      for (const p of points) {
        values.push(crypto.randomUUID(), id, p.timestamp, p.lat, p.lng, p.alt, p.speed);
      }
      await this.db.execute(
        `INSERT INTO route_points (id, route_id, timestamp, lat, lng, alt, speed) VALUES ${placeholders}`,
        values,
      );
    }

    if (stops.length > 0) {
      const placeholders = stops.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values: unknown[] = [];
      for (const s of stops) {
        values.push(crypto.randomUUID(), id, s.startTime, s.endTime, s.lat, s.lng, s.type, s.stopCategoryId);
      }
      await this.db.execute(
        `INSERT INTO route_stops (id, route_id, start_time, end_time, lat, lng, type, stop_type_id) VALUES ${placeholders}`,
        values,
      );
    }

    // save() nunca lista preview_polyline/notes en su INSERT/UPDATE, así que nunca los
    // sobrescribe en BBDD — solo hace falta reflejar el valor ya existente aquí
    // para que el objeto devuelto cumpla el tipo Route.
    return {
      ...route,
      id,
      createdAt,
      previewPolyline: existing?.previewPolyline ?? null,
      name,
      notes: existing?.notes ?? null,
      isFavorite: existing?.isFavorite ?? false,
    };
  }

  async getById(id: string): Promise<Route | null> {
    await this.ensureSchema();
    const rows = await this.db.select(`SELECT * FROM routes WHERE id = ?`, [id]);
    if (rows.length === 0) return null;
    return rowToRoute(rows[0] as unknown as RouteRow);
  }

  async getAll(): Promise<Route[]> {
    await this.ensureSchema();
    const rows = await this.db.select(`SELECT * FROM routes ORDER BY created_at DESC`);
    return rows.map((r) => rowToRoute(r as unknown as RouteRow));
  }

  async getPointsByRouteId(routeId: string): Promise<RoutePoint[]> {
    await this.ensureSchema();
    const rows = await this.db.select(
      `SELECT * FROM route_points WHERE route_id = ? ORDER BY timestamp ASC`,
      [routeId],
    );
    return rows.map((r) => rowToPoint(r as unknown as RoutePointRow));
  }

  async getStopsByRouteId(routeId: string): Promise<RouteStop[]> {
    await this.ensureSchema();
    const rows = await this.db.select(
      `SELECT * FROM route_stops WHERE route_id = ? ORDER BY start_time ASC`,
      [routeId],
    );
    return rows.map((r) => rowToStop(r as unknown as RouteStopRow));
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    // CASCADE se encarga de puntos y paradas
    await this.db.execute(`DELETE FROM routes WHERE id = ?`, [id]);
  }

  async updatePreviewPolyline(routeId: string, polyline: [number, number][]): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(`UPDATE routes SET preview_polyline = ? WHERE id = ?`, [
      JSON.stringify(polyline),
      routeId,
    ]);
  }

  async updateNotes(routeId: string, notes: string | null): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(`UPDATE routes SET notes = ? WHERE id = ?`, [notes, routeId]);
  }

  async updateFavorite(routeId: string, isFavorite: boolean): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(`UPDATE routes SET is_favorite = ? WHERE id = ?`, [isFavorite ? 1 : 0, routeId]);
  }
}

/* ------------------------------------------------------------------ */
/*  Row types formales (lo que devuelve SELECT)                       */
/* ------------------------------------------------------------------ */

interface RouteRow {
  id: string;
  created_at: string;
  duration: number;
  total_distance: number;
  avg_speed: number;
  status: string;
  visibility: string;
  origin: string;
  preview_polyline?: string | null;
  name?: string | null;
  notes?: string | null;
  is_favorite?: number | null;
}

interface RoutePointRow {
  id: string;
  route_id: string;
  timestamp: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

interface RouteStopRow {
  id: string;
  route_id: string;
  start_time: number;
  end_time: number | null;
  lat: number;
  lng: number;
  type: string;
  stop_type_id: number | null;
}

function rowToRoute(r: RouteRow): Route {
  return {
    id: r.id,
    createdAt: r.created_at,
    duration: r.duration,
    totalDistance: r.total_distance,
    avgSpeed: r.avg_speed,
    status: r.status as Route['status'],
    visibility: r.visibility as Route['visibility'],
    origin: r.origin as Route['origin'],
    previewPolyline: r.preview_polyline != null ? (JSON.parse(r.preview_polyline) as [number, number][]) : null,
    name: r.name ?? null,
    notes: r.notes ?? null,
    isFavorite: r.is_favorite === 1,
  };
}

function rowToPoint(r: RoutePointRow): RoutePoint {
  return {
    id: r.id,
    routeId: r.route_id,
    timestamp: r.timestamp,
    lat: r.lat,
    lng: r.lng,
    alt: r.alt,
    speed: r.speed,
  };
}

function rowToStop(r: RouteStopRow): RouteStop {
  return {
    id: r.id,
    routeId: r.route_id,
    startTime: r.start_time,
    endTime: r.end_time,
    lat: r.lat,
    lng: r.lng,
    type: r.type as RouteStop['type'],
    stopCategoryId: r.stop_type_id ?? null,
  };
}