import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_PLACEHOLDER_ICON, achievementIconFor } from './achievement-icons.js';
import type { AchievementRequirementType } from '../models/achievement.types.js';

describe('achievement-icons', () => {
  it('ACHIEVEMENT_PLACEHOLDER_ICON is a 24x24 inline SVG', () => {
    expect(ACHIEVEMENT_PLACEHOLDER_ICON).toMatch(/^<svg viewBox="0 0 24 24">/);
  });
});

describe('achievementIconFor', () => {
  const types: AchievementRequirementType[] = [
    'total_distance_km',
    'monthly_distance_km',
    'route_count',
    'single_route_duration_seconds',
  ];

  it('returns a 24x24 inline SVG for every requirement type', () => {
    for (const type of types) {
      expect(achievementIconFor(type)).toMatch(/^<svg viewBox="0 0 24 24">/);
    }
  });

  it('returns a visually distinct icon per requirement type', () => {
    const icons = types.map((type) => achievementIconFor(type));
    expect(new Set(icons).size).toBe(types.length);
  });
});
