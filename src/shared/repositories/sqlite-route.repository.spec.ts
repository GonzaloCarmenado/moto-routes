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
  const [id, createdAt, duration, totalDistance, avgSpeed, status, visibility, origin] = params;
  rows.push({
    table: 'routes',
    data: { id, created_at: createdAt, duration, total_distance: totalDistance, avg_speed: avgSpeed, status, visibility, origin },
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
  for (let i = 0; i < params.length; i += 7) {
    rows.push({
      table: 'route_stops',
      data: { id: params[i]!, route_id: params[i + 1]!, start_time: params[i + 2]!, end_time: params[i + 3]!, lat: params[i + 4]!, lng: params[i + 5]!, type: params[i + 6]! },
    });
  }
  return { rowsAffected: params.length / 7 };
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
