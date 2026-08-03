import { describe, it, expect } from 'vitest';
import { calculateDistance } from './geo.js';

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
