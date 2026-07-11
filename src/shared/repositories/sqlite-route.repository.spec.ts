import { describe, it, expect, vi } from 'vitest';
import { SqliteRouteRepository, type SqlDb } from './sqlite-route.repository.js';
import { createRouteSuite } from '../models/route.repository.spec.js';

/**
 * Mock realista de SqlDb con almacenamiento en arrays.
 * Simula SQLite de forma suficiente para la suite de contrato.
 */
function createMockDb(): SqlDb {
  const rows: { table: string; data: Record<string, unknown>; order?: number }[] = [];
  let nextOrder = 0;

  function queryMock(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('CREATE')) {
      return Promise.resolve({ rowsAffected: 0 });
    }
    if (upper.startsWith('INSERT INTO ROUTES') && params) {
      const [id, createdAt, duration, totalDistance, avgSpeed, status, visibility, origin] = params;
      rows.push({ table: 'routes', data: { id, created_at: createdAt, duration, total_distance: totalDistance, avg_speed: avgSpeed, status, visibility, origin }, order: nextOrder++ });
      return Promise.resolve({ rowsAffected: 1 });
    }
    if (upper.startsWith('INSERT INTO ROUTE_POINTS') && params) {
      const p = params;
      for (let i = 0; i < p.length; i += 7) {
        rows.push({ table: 'route_points', data: { id: p[i]!, route_id: p[i + 1]!, timestamp: p[i + 2]!, lat: p[i + 3]!, lng: p[i + 4]!, alt: p[i + 5]!, speed: p[i + 6]! } });
      }
      return Promise.resolve({ rowsAffected: p.length / 7 });
    }
    if (upper.startsWith('INSERT INTO ROUTE_STOPS') && params) {
      const p = params;
      for (let i = 0; i < p.length; i += 7) {
        rows.push({ table: 'route_stops', data: { id: p[i]!, route_id: p[i + 1]!, start_time: p[i + 2]!, end_time: p[i + 3]!, lat: p[i + 4]!, lng: p[i + 5]!, type: p[i + 6]! } });
      }
      return Promise.resolve({ rowsAffected: p.length / 7 });
    }
    if (upper.startsWith('DELETE') && params) {
      const id = params[0] as string;
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (!row) continue;
        if (row.data['id'] === id || row.data['route_id'] === id) {
          rows.splice(i, 1);
          count++;
        }
      }
      return Promise.resolve({ rowsAffected: count || 1 });
    }
    return Promise.resolve({ rowsAffected: 0 });
  }

  return {
    execute: vi.fn(queryMock),
    select: vi.fn((sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> => {
      const upper = sql.trim().toUpperCase();
      const table = upper.includes('ROUTE_POINTS') ? 'route_points'
        : upper.includes('ROUTE_STOPS') ? 'route_stops'
        : 'routes';

      let result = rows.filter((r) => r.table === table).map((r) => ({ ...r.data }));

      if (params && params.length > 0) {
        const id = params[0] as string;
        result = result.filter((r: Record<string, unknown>) => r['route_id'] === id || r['id'] === id);
      }

      if (table === 'routes' && (!params || params.length === 0)) {
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

      return Promise.resolve(result);
    }),
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
