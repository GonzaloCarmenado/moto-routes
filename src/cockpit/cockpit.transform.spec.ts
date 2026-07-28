import { describe, it, expect } from 'vitest';
import {
  formatSpeed,
  detectStop,
  sanitizeRouteName,
} from './cockpit.transform.js';

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