import { describe, it, expect } from 'vitest';
import { buildDefaultRouteName, buildRouteDisplayName } from './route-naming.js';

describe('buildDefaultRouteName', () => {
  it('should build a name starting with "Ruta " followed by date and time', () => {
    const result = buildDefaultRouteName('2026-07-27T12:30:00.000Z');
    expect(result.startsWith('Ruta ')).toBe(true);
    // Tolerante a la TZ del entorno de test: solo valida forma, no literal exacto.
    expect(result).toMatch(/^Ruta .+\d{4}.*\d{1,2}:\d{2}$/);
  });

  it('should include the year so routes saved months apart remain distinguishable', () => {
    const result = buildDefaultRouteName('2026-07-27T12:30:00.000Z');
    expect(result).toContain('2026');
  });
});

describe('buildRouteDisplayName', () => {
  it('should return the given name when it is non-empty after trim', () => {
    expect(buildRouteDisplayName('Puerto de la Bonaigua', '2026-07-27T12:30:00.000Z')).toBe(
      'Puerto de la Bonaigua',
    );
  });

  it('should fall back to "Ruta {fecha}" when name is undefined', () => {
    const result = buildRouteDisplayName(undefined, '2026-07-27T12:30:00.000Z');
    expect(result.startsWith('Ruta ')).toBe(true);
    expect(result).toContain('2026');
  });

  it('should fall back to "Ruta {fecha}" when name is empty or whitespace-only', () => {
    const result = buildRouteDisplayName('   ', '2026-07-27T12:30:00.000Z');
    expect(result.startsWith('Ruta ')).toBe(true);
    expect(result).toContain('2026');
  });

  it('should fall back to "Ruta " (empty date) when both name and createdAt are missing', () => {
    expect(buildRouteDisplayName(undefined, undefined)).toBe('Ruta ');
  });
});
