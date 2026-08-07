import { describe, it, expect } from 'vitest';
import { mergeLocalAndCloudRoutes } from './route-list-sync.transform.js';
import type { Route } from '../../shared/models/route.types.js';
import type { CloudRouteSummary } from '../../shared/http/route-cloud-api.service.js';

function makeLocalRoute(id: string): Route {
  return {
    id,
    createdAt: '2026-08-01T10:00:00.000Z',
    duration: 60,
    totalDistance: 10,
    avgSpeed: 30,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: null,
    notes: null,
  };
}

function makeCloudSummary(id: string, overrides: Partial<CloudRouteSummary> = {}): CloudRouteSummary {
  return {
    id,
    createdAt: '2026-08-01T10:00:00.000Z',
    duration: 60,
    totalDistance: 10,
    avgSpeed: 30,
    status: 'completed',
    name: null,
    notes: null,
    ...overrides,
  };
}

describe('mergeLocalAndCloudRoutes', () => {
  it('marca como "local" una ruta que solo existe en este dispositivo', () => {
    const items = mergeLocalAndCloudRoutes([makeLocalRoute('a')], []);

    expect(items).toEqual([{ route: makeLocalRoute('a'), syncState: 'local' }]);
  });

  it('marca como "synced" una ruta que existe en local y en la nube, sin duplicarla', () => {
    const items = mergeLocalAndCloudRoutes([makeLocalRoute('a')], [makeCloudSummary('a')]);

    expect(items).toHaveLength(1);
    expect(items[0]?.syncState).toBe('synced');
    expect(items[0]?.route.id).toBe('a');
  });

  it('marca como "cloud-only" una ruta que solo existe en la nube', () => {
    const items = mergeLocalAndCloudRoutes([], [makeCloudSummary('b')]);

    expect(items).toHaveLength(1);
    expect(items[0]?.syncState).toBe('cloud-only');
    expect(items[0]?.route.origin).toBe('remote');
    expect(items[0]?.route.previewPolyline).toBeNull();
  });

  it('combina los tres casos a la vez sin duplicar ninguna entrada', () => {
    const local = [makeLocalRoute('local-only'), makeLocalRoute('synced')];
    const cloud = [makeCloudSummary('synced'), makeCloudSummary('cloud-only')];

    const items = mergeLocalAndCloudRoutes(local, cloud);

    expect(items).toHaveLength(3);
    const byId = new Map(items.map((i) => [i.route.id, i.syncState]));
    expect(byId.get('local-only')).toBe('local');
    expect(byId.get('synced')).toBe('synced');
    expect(byId.get('cloud-only')).toBe('cloud-only');
  });

  it('sin rutas locales ni de la nube devuelve una lista vacía', () => {
    expect(mergeLocalAndCloudRoutes([], [])).toEqual([]);
  });

  it('ordena el resultado por fecha descendente, intercalando cloud-only con locales en vez de dejarlas siempre al final', () => {
    const local = [
      { ...makeLocalRoute('local-old'), createdAt: '2026-07-18T09:00:00.000Z' },
      { ...makeLocalRoute('local-new'), createdAt: '2026-08-07T10:00:00.000Z' },
    ];
    const cloud = [makeCloudSummary('cloud-mid', { createdAt: '2026-08-01T10:00:00.000Z' })];

    const items = mergeLocalAndCloudRoutes(local, cloud);

    expect(items.map((i) => i.route.id)).toEqual(['local-new', 'cloud-mid', 'local-old']);
  });
});
