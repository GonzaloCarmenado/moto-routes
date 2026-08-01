import { describe, it, expect } from 'vitest';
import { detectStopsFromPoints, formatTimelineTime, formatTimelineCoords, formatTimelineSpeed } from './route-timeline.transform.js';
import type { RoutePoint } from '../../shared/models/route.types.js';

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
/*  Paso 2: detectStopsFromPoints — AC-004 a AC-007                   */
/* ------------------------------------------------------------------ */

describe('detectStopsFromPoints', () => {
  it('AC-004: detecta una parada cuando hay >=30 puntos consecutivos con velocidad <=3 km/h', () => {
    // 35 puntos a 0 km/h (timestamps: 1000, 2000, ..., 35000)
    const points: RoutePoint[] = Array.from({ length: 35 }, (_, i) =>
      makePoint({ timestamp: 1000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
    );
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(1);
    const stop = stops[0]!;
    // startTime debe ser el primer punto donde cae la velocidad (AC-006)
    expect(stop.startTime).toBe(1000);
    // endTime debe ser el último punto de la ruta porque nunca vuelve a moverse (AC-007)
    expect(stop.endTime).toBe(35000);
  });

  it('AC-005: una racha de <30 puntos que vuelve a moverse NO genera parada', () => {
    // 20 puntos lentos, luego 10 rápidos
    const points: RoutePoint[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        makePoint({ id: `slow-${i}`, timestamp: 1000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makePoint({ id: `fast-${i}`, timestamp: 21000 + i * 1000, speed: 50, lat: 40.4168, lng: -3.7039 }),
      ),
    ];
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(0);
  });

  it('AC-006: startTime es el punto donde cae la velocidad por primera vez, no el de confirmación 30 puntos después', () => {
    // 10 puntos rápidos, luego 35 lentos
    const points: RoutePoint[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makePoint({ id: `fast-${i}`, timestamp: 1000 + i * 1000, speed: 50, lat: 40.4168, lng: -3.7038 }),
      ),
      ...Array.from({ length: 35 }, (_, i) =>
        makePoint({ id: `slow-${i}`, timestamp: 11000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
      ),
    ];
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(1);
    const stop = stops[0]!;
    // AC-006: startTime debe ser 11000 (el primer punto lento), no 40000 (el de confirmación 30 puntos después)
    expect(stop.startTime).toBe(11000);
    // AC-006: ubicación debe ser la del punto de inicio (lat/lng del punto en timestamp 11000)
    expect(stop.lat).toBe(40.4168);
    expect(stop.lng).toBe(-3.7038);
  });

  it('AC-006: endTime es el primer punto que supera el umbral tras la parada', () => {
    // 35 puntos lentos, luego 5 rápidos
    const points: RoutePoint[] = [
      ...Array.from({ length: 35 }, (_, i) =>
        makePoint({ id: `slow-${i}`, timestamp: 1000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePoint({ id: `fast-${i}`, timestamp: 36000 + i * 1000, speed: 50, lat: 40.4168, lng: -3.7039 }),
      ),
    ];
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(1);
    const stop = stops[0]!;
    // endTime debe ser 36000 (primer punto rápido), no 35000 (último lento)
    expect(stop.endTime).toBe(36000);
  });

  it('AC-007: ruta que termina con vehículo detenido — endTime = último punto de la ruta', () => {
    // 40 puntos todos lentos — nunca se mueven
    const points: RoutePoint[] = Array.from({ length: 40 }, (_, i) =>
      makePoint({ timestamp: 1000 + i * 1000, speed: 0 }),
    );
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.endTime).toBe(40000);
  });

  it('detecta dos paradas independientes con un tramo de movimiento intermedio', () => {
    // 35 lentos, 10 rápidos, 35 lentos
    const points: RoutePoint[] = [
      ...Array.from({ length: 35 }, (_, i) =>
        makePoint({ id: `slow1-${i}`, timestamp: 1000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makePoint({ id: `fast-${i}`, timestamp: 36000 + i * 1000, speed: 50, lat: 40.4169, lng: -3.7039 }),
      ),
      ...Array.from({ length: 35 }, (_, i) =>
        makePoint({ id: `slow2-${i}`, timestamp: 46000 + i * 1000, speed: 0, lat: 40.4170, lng: -3.7040 }),
      ),
    ];
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(2);
    const s0 = stops[0]!;
    const s1 = stops[1]!;
    expect(s0.startTime).toBe(1000);
    expect(s0.endTime).toBe(36000); // primer punto rápido
    expect(s1.startTime).toBe(46000);
    expect(s1.endTime).toBe(80000); // último punto lento (nunca vuelve a moverse tras 2ª parada)
  });

  it('devuelve array vacío si la velocidad nunca baja de 3 km/h de forma sostenida', () => {
    // 50 puntos todos rápidos
    const points: RoutePoint[] = Array.from({ length: 50 }, (_, i) =>
      makePoint({ timestamp: 1000 + i * 1000, speed: 50 }),
    );
    const stops = detectStopsFromPoints(points);
    expect(stops).toEqual([]);
  });

  it('devuelve array vacío si no hay puntos', () => {
    expect(detectStopsFromPoints([])).toEqual([]);
  });

  it('empieza a contar desde el punto donde la velocidad cae, ignorando puntos rápidos anteriores', () => {
    // 10 rápidos, 30 lentos
    const points: RoutePoint[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makePoint({ id: `fast-${i}`, timestamp: 1000 + i * 1000, speed: 50, lat: 40.4168, lng: -3.7038 }),
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        makePoint({ id: `slow-${i}`, timestamp: 11000 + i * 1000, speed: 0, lat: 40.4168, lng: -3.7038 }),
      ),
    ];
    const stops = detectStopsFromPoints(points);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.startTime).toBe(11000);
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