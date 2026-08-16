/** Tipo de requisito que debe cumplir el agregado correspondiente del usuario para que un logro se otorgue. */
export type AchievementRequirementType =
  | 'total_distance_km'
  | 'monthly_distance_km'
  | 'route_count'
  | 'single_route_duration_seconds';

/** Logro del catálogo, tal como lo devuelve el backend. */
export interface Achievement {
  id: number;
  key: string;
  requirementType: AchievementRequirementType;
  threshold: number;
  title: string;
  description: string;
  icon: string;
}

/** Estado de un logro para el usuario autenticado: otorgado (con fecha) o pendiente (con el progreso actual). */
export interface AchievementProgress {
  achievement: Achievement;
  achievedAt: string | null;
  current: number;
}
