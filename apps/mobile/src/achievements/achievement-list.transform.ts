/**
 * Lógica pura de formateo del progreso de un logro pendiente, según su tipo
 * de requisito — extraído de `achievement-list.element.ts` (composición,
 * no límite de líneas).
 */
import type { AchievementProgress } from '../shared/models/achievement.types.js';
import { formatDuration } from '../shared/utils/format.js';

/** Texto de progreso de un logro pendiente, p. ej. "320/500 km" o "3/25 rutas". */
export function formatAchievementProgress(progress: AchievementProgress): string {
  const { achievement, current } = progress;
  switch (achievement.requirementType) {
    case 'total_distance_km':
    case 'monthly_distance_km':
      return `${current.toFixed(1)}/${achievement.threshold.toFixed(0)} km`;
    case 'route_count':
      return `${Math.floor(current).toString()}/${Math.floor(achievement.threshold).toString()} rutas`;
    case 'single_route_duration_seconds':
      return `${formatDuration(current)} / ${formatDuration(achievement.threshold)}`;
  }
}
