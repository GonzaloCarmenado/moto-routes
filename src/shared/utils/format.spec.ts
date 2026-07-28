import { describe, it, expect } from 'vitest';
import { formatDuration, calculateAvgSpeed } from './format.js';

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
