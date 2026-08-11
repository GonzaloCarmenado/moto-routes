import { describe, it, expect } from 'vitest';
import { buildStopDelimiters, buildTimelineData, formatTimelineTime, formatTimelineCoords, formatTimelineSpeed } from './route-timeline.transform.js';
import type { RoutePoint } from '../../shared/models/route.types.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';
import type { TimelineStopInput } from './route-timeline.types.js';

/* ------------------------------------------------------------------ */
/*  Helpers de datos de prueba                                        */
/* ------------------------------------------------------------------ */

/** Crea un punto de ruta con valores por defecto para reducir boilerplate. */
function makePoint(overrides: Partial<RoutePoint> & { timestamp: number; speed: number }): RoutePoint {
  return {
    id: 'p1',
    routeId: 'r1',
    lat: 40.4168,
    lng: -3.7038,
    alt: 100,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Paso 2: buildStopDelimiters / buildTimelineData — AC-6.1/6.3/6.4  */
/* ------------------------------------------------------------------ */

const MIRADOR: StopCategory = { id: 1, key: 'mirador', label: 'Mirador', icon: '🌄' };
const BAR: StopCategory = { id: 2, key: 'bar-restaurante', label: 'Bar/Restaurante', icon: '🍺' };

describe('buildStopDelimiters', () => {
  it('AC-6.1/6.3: convierte una parada real con categoría resuelta en un delimitador "parada" instantáneo con icono/etiqueta', () => {
    const stops: TimelineStopInput[] = [{ startTime: 5000, lat: 40.42, lng: -3.71, stopCategoryId: 1 }];
    const delimiters = buildStopDelimiters(stops, new Map([[1, MIRADOR]]));
    expect(delimiters).toHaveLength(1);
    const d = delimiters[0]!;
    expect(d.kind).toBe('parada');
    expect(d.startTime).toBe(5000);
    expect(d.endTime).toBe(5000); // instantánea: no hay intervalo, a diferencia de la vieja detección por GPS
    // sistema-iconos-svg: category ya no lleva el emoji, lleva `key` para resolver el SVG en el renderer.
    expect(d.category).toEqual({ key: 'mirador', label: 'Mirador' });
  });

  it('AC-6.4: descarta una parada cuyo stopCategoryId no está en el catálogo resuelto', () => {
    const stops: TimelineStopInput[] = [{ startTime: 5000, lat: 40.42, lng: -3.71, stopCategoryId: 99 }];
    const delimiters = buildStopDelimiters(stops, new Map([[1, MIRADOR]]));
    expect(delimiters).toEqual([]);
  });

  it('AC-6.4: descarta una parada sin categoría asignada (stopCategoryId null)', () => {
    const stops: TimelineStopInput[] = [{ startTime: 5000, lat: 40.42, lng: -3.71, stopCategoryId: null }];
    const delimiters = buildStopDelimiters(stops, new Map([[1, MIRADOR]]));
    expect(delimiters).toEqual([]);
  });

  it('ordena las paradas por startTime', () => {
    const stops: TimelineStopInput[] = [
      { startTime: 9000, lat: 40.43, lng: -3.72, stopCategoryId: 2 },
      { startTime: 3000, lat: 40.42, lng: -3.71, stopCategoryId: 1 },
    ];
    const delimiters = buildStopDelimiters(stops, new Map([[1, MIRADOR], [2, BAR]]));
    expect(delimiters.map((d) => d.startTime)).toEqual([3000, 9000]);
  });

  it('devuelve array vacío sin paradas', () => {
    expect(buildStopDelimiters([], new Map())).toEqual([]);
  });
});

describe('buildTimelineData - paradas reales (AC-6.1/6.4)', () => {
  it('AC-6.1: una parada real con categoría resuelta aparece como fila "parada" entre Salida y Llegada', () => {
    const points: RoutePoint[] = [
      makePoint({ timestamp: 1000, speed: 50 }),
      makePoint({ timestamp: 5000, speed: 0 }),
      makePoint({ timestamp: 9000, speed: 50 }),
    ];
    const stops: TimelineStopInput[] = [{ startTime: 5000, lat: 40.4168, lng: -3.7038, stopCategoryId: 1 }];
    const data = buildTimelineData(points, [], stops, new Map([[1, MIRADOR]]));
    const kinds = data.rows.map((r) => r.delimiter.kind);
    expect(kinds).toEqual(['salida', 'parada', 'llegada']);
  });

  it('AC-6.4: una ruta sin ninguna parada tipada no muestra ningún delimitador de parada', () => {
    const points: RoutePoint[] = [
      makePoint({ timestamp: 1000, speed: 50 }),
      makePoint({ timestamp: 9000, speed: 50 }),
    ];
    const data = buildTimelineData(points, [], [], new Map());
    const kinds = data.rows.map((r) => r.delimiter.kind);
    expect(kinds).toEqual(['salida', 'llegada']);
  });
});

/* ------------------------------------------------------------------ */
/*  Paso 3: Helpers de formato — AC-019, AC-020, AC-021               */
/* ------------------------------------------------------------------ */

describe('formatTimelineTime (AC-019)', () => {
  it('formatea un epoch ms a HH:mm en 24h', () => {
    // 2026-07-27T14:30:00Z
    const date = new Date('2026-07-27T14:30:00Z').getTime();
    const result = formatTimelineTime(date);
    // No podemos asumir timezone UTC, pero debe tener formato HH:mm con 2 dígitos
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('usa formato 24h, no 12h con AM/PM', () => {
    const date = new Date('2026-07-27T23:45:00Z').getTime();
    const result = formatTimelineTime(date);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatTimelineCoords (AC-020)', () => {
  it('formatea lat/lng con exactamente 4 decimales', () => {
    const result = formatTimelineCoords(40.4168, -3.7038);
    expect(result).toBe('40.4168, -3.7038');
  });

  it('rellena con ceros si hay menos decimales', () => {
    const result = formatTimelineCoords(40.4, -3.7);
    expect(result).toBe('40.4000, -3.7000');
  });

  it('maneja coordenadas negativas', () => {
    const result = formatTimelineCoords(-34.6037, -58.3816);
    expect(result).toBe('-34.6037, -58.3816');
  });

  it('maneja lat/lng con 0', () => {
    const result = formatTimelineCoords(0, 0);
    expect(result).toBe('0.0000, 0.0000');
  });
});

describe('formatTimelineSpeed (AC-021)', () => {
  it('formatea un número entero como "X km/h"', () => {
    expect(formatTimelineSpeed(75)).toBe('75 km/h');
  });

  it('redondea hacia abajo', () => {
    expect(formatTimelineSpeed(74.3)).toBe('74 km/h');
  });

  it('redondea hacia arriba', () => {
    expect(formatTimelineSpeed(74.7)).toBe('75 km/h');
  });

  it('maneja velocidad 0', () => {
    expect(formatTimelineSpeed(0)).toBe('0 km/h');
  });
});