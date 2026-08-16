import { describe, it, expect } from 'vitest';
import { formatAchievementProgress } from './achievement-list.transform.js';
import type { AchievementProgress, Achievement } from '../shared/models/achievement.types.js';

function makeAchievement(overrides?: Partial<Achievement>): Achievement {
  return {
    id: 1,
    key: 'test',
    requirementType: 'total_distance_km',
    threshold: 500,
    title: 'Test',
    description: 'Test',
    icon: 'default',
    ...overrides,
  };
}

describe('formatAchievementProgress', () => {
  it('formats total_distance_km as "current/threshold km"', () => {
    const progress: AchievementProgress = {
      achievement: makeAchievement({ requirementType: 'total_distance_km', threshold: 500 }),
      achievedAt: null,
      current: 320.4,
    };
    expect(formatAchievementProgress(progress)).toBe('320.4/500 km');
  });

  it('formats monthly_distance_km as "current/threshold km"', () => {
    const progress: AchievementProgress = {
      achievement: makeAchievement({ requirementType: 'monthly_distance_km', threshold: 100 }),
      achievedAt: null,
      current: 42,
    };
    expect(formatAchievementProgress(progress)).toBe('42.0/100 km');
  });

  it('formats route_count as "current/threshold rutas"', () => {
    const progress: AchievementProgress = {
      achievement: makeAchievement({ requirementType: 'route_count', threshold: 25 }),
      achievedAt: null,
      current: 7,
    };
    expect(formatAchievementProgress(progress)).toBe('7/25 rutas');
  });

  it('formats single_route_duration_seconds as "MM:SS / MM:SS"', () => {
    const progress: AchievementProgress = {
      achievement: makeAchievement({ requirementType: 'single_route_duration_seconds', threshold: 3600 }),
      achievedAt: null,
      current: 1800,
    };
    expect(formatAchievementProgress(progress)).toBe('30:00 / 1:00:00');
  });
});
