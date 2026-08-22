import { describe, it, expect, vi } from 'vitest';
import { SqliteRouteRepository, type SqlDb } from './sqlite-route.repository.js';
import { createRouteSuite } from '../models/route.repository.spec.js';

/**
 * Mock realista de SqlDb con almacenamiento en arrays.
 * Simula SQLite de forma suficiente para la suite de contrato.
 */
interface DbRow {
  table: string;
  data: Record<string, unknown>;
  order?: number;
}

function insertRoute(rows: DbRow[], orderState: { value: number }, params: unknown[]): { rowsAffected: number } {
  const [id, createdAt, duration, totalDistance, avgSpeed, status, visibility, origin, name] = params;
  rows.push({
    table: 'routes',
    data: { id, created_at: createdAt, duration, total_distance: totalDistance, avg_speed: avgSpeed, status, visibility, origin, name: name ?? null },
    order: orderState.value++,
  });
  return { rowsAffected: 1 };
}

function insertPoints(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  for (let i = 0; i < params.length; i += 7) {
    rows.push({
      table: 'route_points',
      data: { id: params[i]!, route_id: params[i + 1]!, timestamp: params[i + 2]!, lat: params[i + 3]!, lng: params[i + 4]!, alt: params[i + 5]!, speed: params[i + 6]! },
    });
  }
  return { rowsAffected: params.length / 7 };
}

function insertStops(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  for (let i = 0; i < params.length; i += 8) {
    rows.push({
      table: 'route_stops',
      data: {
        id: params[i]!,
        route_id: params[i + 1]!,
        start_time: params[i + 2]!,
        end_time: params[i + 3]!,
        lat: params[i + 4]!,
        lng: params[i + 5]!,
        type: params[i + 6]!,
        stop_type_id: params[i + 7] ?? null,
      },
    });
  }
  return { rowsAffected: params.length / 8 };
}

function updateRoute(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  const [duration, totalDistance, avgSpeed, status, visibility, origin, name, id] = params;
  const row = rows.find((r) => r.table === 'routes' && r.data['id'] === id);
  if (!row) return { rowsAffected: 0 };
  row.data = { ...row.data, duration, total_distance: totalDistance, avg_speed: avgSpeed, status, visibility, origin, name: name ?? null };
  return { rowsAffected: 1 };
}

function updateNotes(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  const [notes, id] = params;
  const row = rows.find((r) => r.table === 'routes' && r.data['id'] === id);
  if (!row) return { rowsAffected: 0 };
  row.data = { ...row.data, notes };
  return { rowsAffected: 1 };
}

function updateFavorite(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  const [isFavorite, id] = params;
  const row = rows.find((r) => r.table === 'routes' && r.data['id'] === id);
  if (!row) return { rowsAffected: 0 };
  row.data = { ...row.data, is_favorite: isFavorite };
  return { rowsAffected: 1 };
}

function updatePreviewPolyline(rows: DbRow[], params: unknown[]): { rowsAffected: number } {
  const [previewPolyline, id] = params;
  const row = rows.find((r) => r.table === 'routes' && r.data['id'] === id);
  if (!row) return { rowsAffected: 0 };
  row.data = { ...row.data, preview_polyline: previewPolyline };
  return { rowsAffected: 1 };
}

function deleteRows(rows: DbRow[], id: string): { rowsAffected: number } {
  let count = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) continue;
    if (row.data['id'] === id || row.data['route_id'] === id) {
      rows.splice(i, 1);
      count++;
    }
  }
  return { rowsAffected: count || 1 };
}

function queryMock(rows: DbRow[], orderState: { value: number }, sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith('CREATE')) return Promise.resolve({ rowsAffected: 0 });
  if (upper.startsWith('INSERT INTO ROUTES') && params) return Promise.resolve(insertRoute(rows, orderState, params));
  if (upper.startsWith('INSERT INTO ROUTE_POINTS') && params) return Promise.resolve(insertPoints(rows, params));
  if (upper.startsWith('INSERT INTO ROUTE_STOPS') && params) return Promise.resolve(insertStops(rows, params));
  if (upper.startsWith('UPDATE ROUTES SET PREVIEW_POLYLINE') && params) {
    return Promise.resolve(updatePreviewPolyline(rows, params));
  }
  if (upper.startsWith('UPDATE ROUTES SET NOTES') && params) {
    return Promise.resolve(updateNotes(rows, params));
  }
  if (upper.startsWith('UPDATE ROUTES SET IS_FAVORITE') && params) {
    return Promise.resolve(updateFavorite(rows, params));
  }
  if (upper.startsWith('UPDATE ROUTES') && params) return Promise.resolve(updateRoute(rows, params));
  if (upper.startsWith('DELETE') && params) return Promise.resolve(deleteRows(rows, params[0] as string));
  return Promise.resolve({ rowsAffected: 0 });
}

function tableForSql(upper: string): string {
  if (upper.includes('ROUTE_POINTS')) return 'route_points';
  if (upper.includes('ROUTE_STOPS')) return 'route_stops';
  return 'routes';
}

function sortRoutesByInsertionOrder(rows: DbRow[], result: Record<string, unknown>[]): void {
  result.sort((a, b) => {
    const aTs = String(a.created_at);
    const bTs = String(b.created_at);
    const cmp = bTs.localeCompare(aTs);
    if (cmp !== 0) return cmp;
    // Same timestamp → insertion order
    const aOrder = rows.find((r) => r.data['id'] === a['id'])?.order ?? 0;
    const bOrder = rows.find((r) => r.data['id'] === b['id'])?.order ?? 0;
    return bOrder - aOrder;
  });
}

function selectMock(rows: DbRow[], sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  const upper = sql.trim().toUpperCase();
  const table = tableForSql(upper);

  let result = rows.filter((r) => r.table === table).map((r) => ({ ...r.data }));

  if (params && params.length > 0) {
    const id = params[0] as string;
    result = result.filter((r: Record<string, unknown>) => r['route_id'] === id || r['id'] === id);
  }

  if (table === 'routes' && (!params || params.length === 0)) {
    sortRoutesByInsertionOrder(rows, result);
  }

  return Promise.resolve(result);
}

function createMockDb(): SqlDb {
  const rows: DbRow[] = [];
  const orderState = { value: 0 };

  return {
    execute: vi.fn((sql: string, params?: unknown[]) => queryMock(rows, orderState, sql, params)),
    select: vi.fn((sql: string, params?: unknown[]) => selectMock(rows, sql, params)),
  };
}

/**
 * Mock dedicado para el mecanismo de migración de columna (AC-025/AC-032).
 * El mock compartido `createMockDb()` no modela `PRAGMA table_info`, así que
 * no sirve para verificar el check-y-ALTER TABLE — se necesita uno propio
 * y más explícito, igual que ya advierte el plan de esta feature.
 */
interface MigrationMockOptions {
  hasPreviewPolylineColumn?: boolean;
  hasNameColumn?: boolean;
  hasNotesColumn?: boolean;
  /** Por defecto `true`: estas suites cubren las columnas de `routes`, no la
   * migración de `route_stops` (ver describe dedicado más abajo) — sin esto,
   * cada test contaría también el ALTER TABLE de `stop_type_id`. */
  hasStopTypeIdColumn?: boolean;
  /** Por defecto `true`, mismo criterio que `hasStopTypeIdColumn` — solo se
   * pone a `false` en el describe dedicado a la migración de `is_favorite`. */
  hasFavoriteColumn?: boolean;
}

function createMigrationMockDb(options: MigrationMockOptions = {}): {
  db: SqlDb;
  alterTableCalls: string[];
} {
  const {
    hasPreviewPolylineColumn = false, hasNameColumn = false, hasNotesColumn = false, hasStopTypeIdColumn = true,
    hasFavoriteColumn = true,
  } = options;
  const alterTableCalls: string[] = [];
  const preexistingRow = {
    id: 'legacy-route-1',
    created_at: '2026-01-01T00:00:00.000Z',
    duration: 1200,
    total_distance: 42.5,
    avg_speed: 65,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
  };
  const columnInfo = [
    { name: 'id' },
    { name: 'created_at' },
    { name: 'duration' },
    { name: 'total_distance' },
    { name: 'avg_speed' },
    { name: 'status' },
    { name: 'visibility' },
    { name: 'origin' },
    ...(hasPreviewPolylineColumn ? [{ name: 'preview_polyline' }] : []),
    ...(hasNameColumn ? [{ name: 'name' }] : []),
    ...(hasNotesColumn ? [{ name: 'notes' }] : []),
    ...(hasFavoriteColumn ? [{ name: 'is_favorite' }] : []),
  ];
  const stopColumnInfo = [
    { name: 'id' },
    { name: 'route_id' },
    { name: 'start_time' },
    { name: 'end_time' },
    { name: 'lat' },
    { name: 'lng' },
    { name: 'type' },
    ...(hasStopTypeIdColumn ? [{ name: 'stop_type_id' }] : []),
  ];

  const db: SqlDb = {
    execute: vi.fn((sql: string) => {
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('ALTER TABLE')) alterTableCalls.push(sql.trim());
      return Promise.resolve({ rowsAffected: 0 });
    }),
    select: vi.fn((sql: string) => {
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('PRAGMA TABLE_INFO(ROUTE_STOPS')) return Promise.resolve(stopColumnInfo);
      if (upper.startsWith('PRAGMA TABLE_INFO')) return Promise.resolve(columnInfo);
      if (upper.startsWith('SELECT * FROM ROUTES')) return Promise.resolve([{ ...preexistingRow }]);
      return Promise.resolve([]);
    }),
  };

  return { db, alterTableCalls };
}

describe('preview_polyline column migration (AC-025, AC-032)', () => {
  it('runs ALTER TABLE exactly once when preview_polyline is missing from a preexisting routes table, keeping the existing row intact', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({ hasNameColumn: true, hasNotesColumn: true });
    const repo = new SqliteRouteRepository(db);

    const all = await repo.getAll();

    expect(alterTableCalls).toHaveLength(1);
    expect(alterTableCalls[0]).toBe('ALTER TABLE routes ADD COLUMN preview_polyline TEXT;');

    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe('legacy-route-1');
    expect(all[0]!.duration).toBe(1200);
    expect(all[0]!.totalDistance).toBe(42.5);
    expect(all[0]!.avgSpeed).toBe(65);
    expect(all[0]!.status).toBe('completed');
    expect(all[0]!.visibility).toBe('private');
    expect(all[0]!.origin).toBe('local');
    expect(all[0]!.previewPolyline).toBeNull();
  });

  it('does not run ALTER TABLE when preview_polyline already exists', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true,
    });
    const repo = new SqliteRouteRepository(db);

    await repo.getAll();

    expect(alterTableCalls).toHaveLength(0);
  });

  it('runs the migration exactly once when two callers race on the same shared repository instance (regression: route-list + profile-view both mount and call getAll() concurrently on app start, previously causing a "duplicate column name" SQLite error on the second ALTER TABLE)', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({ hasNameColumn: true, hasNotesColumn: true });
    const repo = new SqliteRouteRepository(db);

    await Promise.all([repo.getAll(), repo.getAll()]);

    expect(alterTableCalls).toHaveLength(1);
  });
});

describe('name/notes columns migration (AC-004, AC-007, AC-015)', () => {
  it('runs ALTER TABLE exactly once for name and once for notes when both are missing from a preexisting routes table, keeping the existing row intact', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({ hasPreviewPolylineColumn: true });
    const repo = new SqliteRouteRepository(db);

    const all = await repo.getAll();

    expect(alterTableCalls).toContain('ALTER TABLE routes ADD COLUMN name TEXT;');
    expect(alterTableCalls).toContain('ALTER TABLE routes ADD COLUMN notes TEXT;');
    expect(alterTableCalls).toHaveLength(2);

    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe('legacy-route-1');
    expect(all[0]!.name).toBeNull();
    expect(all[0]!.notes).toBeNull();
  });

  it('does not run ALTER TABLE for name/notes when both already exist', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true,
    });
    const repo = new SqliteRouteRepository(db);

    await repo.getAll();

    expect(alterTableCalls).toHaveLength(0);
  });
});

describe('is_favorite column migration (favoritos-rutas)', () => {
  it('runs ALTER TABLE exactly once when is_favorite is missing from a preexisting routes table, keeping the existing row intact', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true, hasFavoriteColumn: false,
    });
    const repo = new SqliteRouteRepository(db);

    const all = await repo.getAll();

    expect(alterTableCalls).toContain('ALTER TABLE routes ADD COLUMN is_favorite INTEGER;');
    expect(alterTableCalls).toHaveLength(1);

    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe('legacy-route-1');
    expect(all[0]!.isFavorite).toBe(false);
  });

  it('does not run ALTER TABLE when is_favorite already exists', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true, hasFavoriteColumn: true,
    });
    const repo = new SqliteRouteRepository(db);

    await repo.getAll();

    expect(alterTableCalls).toHaveLength(0);
  });
});

describe('stop_type_id column migration (catalogo-tipos-parada)', () => {
  it('runs ALTER TABLE exactly once when stop_type_id is missing from a preexisting route_stops table', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true, hasStopTypeIdColumn: false,
    });
    const repo = new SqliteRouteRepository(db);

    await repo.getAll();

    expect(alterTableCalls).toContain('ALTER TABLE route_stops ADD COLUMN stop_type_id INTEGER;');
    expect(alterTableCalls).toHaveLength(1);
  });

  it('does not run ALTER TABLE when stop_type_id already exists', async () => {
    const { db, alterTableCalls } = createMigrationMockDb({
      hasPreviewPolylineColumn: true, hasNameColumn: true, hasNotesColumn: true, hasStopTypeIdColumn: true,
    });
    const repo = new SqliteRouteRepository(db);

    await repo.getAll();

    expect(alterTableCalls).toHaveLength(0);
  });
});

describe('save() troceado de puntos/paradas (bug real: rutas largas perdían todos sus puntos GPS)', () => {
  it('persiste todos los puntos de una ruta larga (más de un chunk) en varios INSERT, no uno solo', async () => {
    const db = createMockDb();
    const repo = new SqliteRouteRepository(db);
    const pointCount = 1200; // > INSERT_CHUNK_SIZE (500): fuerza al menos 3 INSERT
    const points = Array.from({ length: pointCount }, (_, i) => ({
      routeId: '', timestamp: i, lat: 40 + i * 0.0001, lng: -3 + i * 0.0001, alt: 1000, speed: 20,
    }));

    await repo.save(
      { id: 'route-long', duration: pointCount, totalDistance: 200, avgSpeed: 65, status: 'completed', visibility: 'private', origin: 'local' },
      points,
      [],
    );

    const stored = await repo.getPointsByRouteId('route-long');
    expect(stored).toHaveLength(pointCount);

    const insertCalls = vi.mocked(db.execute).mock.calls.filter(([sql]) => sql.trim().toUpperCase().startsWith('INSERT INTO ROUTE_POINTS'));
    expect(insertCalls.length).toBeGreaterThan(1);
    for (const [, params] of insertCalls) {
      expect((params as unknown[]).length).toBeLessThanOrEqual(500 * 7);
    }
  });

  it('persiste todas las paradas de una ruta con más paradas que un chunk', async () => {
    const db = createMockDb();
    const repo = new SqliteRouteRepository(db);
    const stopCount = 600; // > INSERT_CHUNK_SIZE (500): fuerza al menos 2 INSERT
    const stops = Array.from({ length: stopCount }, (_, i) => ({
      routeId: 'route-long-stops', startTime: i, endTime: i + 1, lat: 40, lng: -3, type: 'manual' as const, stopCategoryId: null,
    }));

    await repo.save(
      { id: 'route-long-stops', duration: 100, totalDistance: 10, avgSpeed: 5, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      stops,
    );

    const stored = await repo.getStopsByRouteId('route-long-stops');
    expect(stored).toHaveLength(stopCount);

    const insertCalls = vi.mocked(db.execute).mock.calls.filter(([sql]) => sql.trim().toUpperCase().startsWith('INSERT INTO ROUTE_STOPS'));
    expect(insertCalls.length).toBeGreaterThan(1);
  });
});

describe('SqliteRouteRepository SQL injection safety', () => {
  it('should use parameterized queries', () => {
    const db = createMockDb();
    const repo = new SqliteRouteRepository(db);
    expect(repo).toBeDefined();
  });
});

// Ejecutar la suite de contrato contra SqliteRouteRepository con mock
createRouteSuite('SqliteRouteRepository (mock DB)', () => {
  return new SqliteRouteRepository(createMockDb());
});
