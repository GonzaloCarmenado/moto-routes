import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  formatDuration,
  calculateAvgSpeed,
  formatSpeed,
  detectStop,
  sanitizeRouteName,
  buildDefaultRouteName,
} from './cockpit.transform.js';

describe('calculateDistance', () => {
  it('should return 0 for same point', () => {
    const distance = calculateDistance(
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4168, lng: -3.7038 },
    );
    expect(distance).toBe(0);
  });

  it('should calculate approximate distance between Madrid and Barcelona', () => {
    const distance = calculateDistance(
      { lat: 40.4168, lng: -3.7038 },
      { lat: 41.3874, lng: 2.1686 },
    );
    // ~505 km
    expect(distance).toBeGreaterThan(490);
    expect(distance).toBeLessThan(520);
  });

  it('should calculate small distances accurately', () => {
    const distance = calculateDistance(
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.417, lng: -3.7035 },
    );
    // ~25 meters = 0.025 km
    expect(distance).toBeGreaterThan(0.02);
    expect(distance).toBeLessThan(0.035);
  });
});

describe('formatDuration', () => {
  it('should format 0 seconds as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('should format 65 seconds as 01:05', () => {
    expect(formatDuration(65)).toBe('01:05');
  });

  it('should format 3661 seconds as 1:01:01', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('should format 7322 seconds as 2:02:02', () => {
    expect(formatDuration(7322)).toBe('2:02:02');
  });

  it('should format seconds under 60 correctly', () => {
    expect(formatDuration(45)).toBe('00:45');
  });

  it('should format exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });
});

describe('calculateAvgSpeed', () => {
  it('should return 0 when time is 0', () => {
    expect(calculateAvgSpeed(100, 0)).toBe(0);
  });

  it('should calculate speed correctly', () => {
    // 100 km en 1 hora = 100 km/h
    expect(calculateAvgSpeed(100, 3600)).toBeCloseTo(100, 0);
  });

  it('should calculate speed for short distances', () => {
    // 1 km en 60 segundos = 60 km/h
    expect(calculateAvgSpeed(1, 60)).toBeCloseTo(60, 0);
  });
});

describe('formatSpeed', () => {
  it('should format speed as integer', () => {
    expect(formatSpeed(85.7)).toBe('86');
  });

  it('should format 0 speed as 0', () => {
    expect(formatSpeed(0)).toBe('0');
  });

  it('should round down correctly', () => {
    expect(formatSpeed(45.2)).toBe('45');
  });
});

describe('detectStop', () => {
  it('should return moving when speed > 3 km/h', () => {
    const result = detectStop(10, 0, 'moving');
    expect(result.state).toBe('moving');
    expect(result.timer).toBe(0);
  });

  it('should start timer when speed < 3 km/h', () => {
    const result = detectStop(2, 0, 'moving');
    expect(result.state).toBe('possible-stop');
    expect(result.timer).toBe(1);
  });

  it('should increment timer while speed < 3 km/h', () => {
    const result = detectStop(2, 15, 'possible-stop');
    expect(result.state).toBe('possible-stop');
    expect(result.timer).toBe(16);
  });

  it('should confirm stop after 30 seconds', () => {
    const result = detectStop(2, 30, 'possible-stop');
    expect(result.state).toBe('confirmed-stop');
    expect(result.timer).toBe(31);
  });

  it('should stay confirmed if speed still < 3', () => {
    const result = detectStop(2, 35, 'confirmed-stop');
    expect(result.state).toBe('confirmed-stop');
    expect(result.timer).toBe(36);
  });

  it('should reset when speed > 3 before 30s (semaphore)', () => {
    const result = detectStop(10, 15, 'possible-stop');
    expect(result.state).toBe('moving');
    expect(result.timer).toBe(0);
  });

  it('should move again when speed > 3 after confirmed stop', () => {
    const result = detectStop(10, 45, 'confirmed-stop');
    expect(result.state).toBe('moving');
    expect(result.timer).toBe(0);
  });

  it('should not reset timer on gps signal loss', () => {
    const result = detectStop(undefined, 15, 'possible-stop');
    expect(result.state).toBe('possible-stop');
    expect(result.timer).toBe(16);
  });
});

describe('sanitizeRouteName', () => {
  it('should trim leading and trailing whitespace (AC-003)', () => {
    expect(sanitizeRouteName('  Puerto de la Bonaigua  ')).toBe('Puerto de la Bonaigua');
  });

  it('should return an empty string for a whitespace-only name, preparing the AC-002 fallback', () => {
    expect(sanitizeRouteName('   ')).toBe('');
  });

  it('should truncate a name longer than 100 characters to exactly 100 (AC-009)', () => {
    const result = sanitizeRouteName('a'.repeat(150));
    expect(result).toHaveLength(100);
  });

  it('should leave a short name untouched other than trimming', () => {
    expect(sanitizeRouteName('Ruta de prueba')).toBe('Ruta de prueba');
  });
});

describe('buildDefaultRouteName (AC-002)', () => {
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