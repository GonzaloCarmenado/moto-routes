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
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  );
`;

/**
 * Implementación de IRouteRepository usando SQLite via Tauri plugin.
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqliteRouteRepository implements IRouteRepository {
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

  async save(
    route: CreateRoute,
    points: CreateRoutePoint[],
    stops: CreateRouteStop[],
  ): Promise<Route> {
    await this.ensureSchema();

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO routes (id, created_at, duration, total_distance, avg_speed, status, visibility, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, createdAt, route.duration, route.totalDistance, route.avgSpeed, route.status, route.visibility, route.origin],
    );

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
      const placeholders = stops.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values: unknown[] = [];
      for (const s of stops) {
        values.push(crypto.randomUUID(), id, s.startTime, s.endTime, s.lat, s.lng, s.type);
      }
      await this.db.execute(
        `INSERT INTO route_stops (id, route_id, start_time, end_time, lat, lng, type) VALUES ${placeholders}`,
        values,
      );
    }

    return { id, createdAt, ...route };
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
  };
}