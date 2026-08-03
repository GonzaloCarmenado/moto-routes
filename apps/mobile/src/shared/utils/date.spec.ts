import { describe, it, expect } from 'vitest';
import { formatRouteDate } from './date.js';

describe('formatRouteDate', () => {
  it('should format an ISO date as "day month(short) year" in es-ES', () => {
    const result = formatRouteDate('2026-07-27T12:30:00.000Z');
    // Tolerante a la TZ del entorno de test: solo valida forma, no literal exacto.
    expect(result).toMatch(/^\d{1,2} [a-záéíóúñ.]+ 2026$/i);
  });

  it('should return an empty string for undefined', () => {
    expect(formatRouteDate(undefined)).toBe('');
  });
});
