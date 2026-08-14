import { describe, it, expect } from 'vitest';
import { resolveDisplayName, sanitizeProfileName, computeProfileStats } from './profile.transform.js';
import { sanitizeText } from '../shared/utils/text.js';
import type { Route } from '../shared/models/index.js';

/** Construye una `Route` completa a partir de un subconjunto de overrides, para no repetir todos los campos en cada test. */
function buildRoute(overrides: Partial<Route>): Route {
  return {
    id: overrides.id ?? 'route-1',
    createdAt: overrides.createdAt ?? '2026-07-27T12:30:00.000Z',
    duration: overrides.duration ?? 0,
    totalDistance: overrides.totalDistance ?? 0,
    avgSpeed: overrides.avgSpeed ?? 0,
    status: overrides.status ?? 'completed',
    visibility: overrides.visibility ?? 'private',
    origin: overrides.origin ?? 'local',
    previewPolyline: overrides.previewPolyline ?? null,
    name: overrides.name ?? null,
    notes: overrides.notes ?? null,
    isFavorite: overrides.isFavorite ?? false,
  };
}

describe('resolveDisplayName', () => {
  it('should return the placeholder when name is null', () => {
    expect(resolveDisplayName(null)).toBe('Motorista sin nombre');
  });

  it('should return the placeholder when name is an empty string', () => {
    expect(resolveDisplayName('')).toBe('Motorista sin nombre');
  });

  it('should return the placeholder when name is only whitespace', () => {
    expect(resolveDisplayName('   ')).toBe('Motorista sin nombre');
  });

  it('should return the given name as-is when present', () => {
    expect(resolveDisplayName('Marc')).toBe('Marc');
  });
});

describe('sanitizeProfileName', () => {
  it('should delegate in sanitizeText with a 100 character limit', () => {
    const raw = `  ${'a'.repeat(150)}  `;
    expect(sanitizeProfileName(raw)).toBe(sanitizeText(raw, 100));
  });

  it('should trim surrounding whitespace', () => {
    expect(sanitizeProfileName('  Marc  ')).toBe('Marc');
  });
});

describe('computeProfileStats', () => {
  it('should return null when there are no routes at all', () => {
    expect(computeProfileStats([])).toBeNull();
  });

  it('should return null when no route has status completed', () => {
    const routes = [buildRoute({ status: 'active' }), buildRoute({ status: 'archived' })];
    expect(computeProfileStats(routes)).toBeNull();
  });

  it('should compute totals only from completed routes, ignoring active and archived ones', () => {
    const routes = [
      buildRoute({ id: 'r1', status: 'completed', totalDistance: 20, name: 'Corta' }),
      buildRoute({ id: 'r2', status: 'completed', totalDistance: 45, name: 'Media' }),
      buildRoute({ id: 'r3', status: 'completed', totalDistance: 120, name: 'Larga' }),
      buildRoute({ id: 'r4', status: 'active', totalDistance: 999 }),
    ];

    const stats = computeProfileStats(routes);

    expect(stats).not.toBeNull();
    expect(stats?.totalDistanceKm).toBe(185);
    expect(stats?.routeCount).toBe(3);
    expect(stats?.longestRoute.distanceKm).toBe(120);
  });

  it('should use route.name for longestRoute.name when present', () => {
    const routes = [buildRoute({ status: 'completed', totalDistance: 120, name: 'Puerto de la Bonaigua' })];
    const stats = computeProfileStats(routes);
    expect(stats?.longestRoute.name).toBe('Puerto de la Bonaigua');
  });

  it('should fall back to buildRouteDisplayName for longestRoute.name when route.name is null', () => {
    const routes = [
      buildRoute({ status: 'completed', totalDistance: 120, name: null, createdAt: '2026-07-27T12:30:00.000Z' }),
    ];
    const stats = computeProfileStats(routes);
    expect(stats?.longestRoute.name.startsWith('Ruta ')).toBe(true);
    expect(stats?.longestRoute.name).toContain('2026');
  });

  it('should compute avgSpeedHistoric as the arithmetic mean of avgSpeed, not derived from distance/time', () => {
    // Media de avgSpeed: (60 + 100) / 2 = 80.
    // Media derivada de distancia/tiempo (incorrecta) sería distinta: 165km / (2h) = 82.5 km/h.
    const routes = [
      buildRoute({ status: 'completed', totalDistance: 60, duration: 3600, avgSpeed: 60 }),
      buildRoute({ status: 'completed', totalDistance: 100, duration: 3600, avgSpeed: 100 }),
    ];
    const stats = computeProfileStats(routes);
    expect(stats?.avgSpeedHistoric).toBe(80);
  });

  it('should sum duration into totalDurationSeconds', () => {
    const routes = [
      buildRoute({ status: 'completed', duration: 1800 }),
      buildRoute({ status: 'completed', duration: 3600 }),
    ];
    const stats = computeProfileStats(routes);
    expect(stats?.totalDurationSeconds).toBe(5400);
  });

  it('should not produce NaN/Infinity values with a single completed route', () => {
    const routes = [buildRoute({ status: 'completed', totalDistance: 42, duration: 1200, avgSpeed: 55 })];
    const stats = computeProfileStats(routes);

    expect(stats).not.toBeNull();
    expect(Number.isFinite(stats?.totalDistanceKm)).toBe(true);
    expect(Number.isFinite(stats?.totalDurationSeconds)).toBe(true);
    expect(Number.isFinite(stats?.avgSpeedHistoric)).toBe(true);
    expect(Number.isFinite(stats?.longestRoute.distanceKm)).toBe(true);
  });
});
