/**
 * Iconos SVG (inline, `stroke="currentColor"`) de logros — mismo estilo
 * sobrio de 2 colores que el resto de `shared/icons/` (ver ADR-046). Cada
 * tipo de requisito tiene su propio icono, deliberadamente poco preciso
 * (no ilustra el umbral exacto) pero reconocible por categoría — cumple la
 * personalización por logro que `design.md` de `sistema-logros` dejaba como
 * trabajo futuro (Non-Goals), sin tocar backend/spec (cambio puntual).
 */
import type { AchievementRequirementType } from '../models/achievement.types.js';

/** Icono genérico de logro (medalla) — usado donde no hay un logro concreto que representar, p. ej. la entrada "Mis logros" del perfil. */
export const ACHIEVEMENT_PLACEHOLDER_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="m8.5 14 -1.5 7 5 -3 5 3 -1.5 -7"/></svg>`;

/** Km recorridos (totales o del mes): carretera con línea central discontinua. */
const ACHIEVEMENT_DISTANCE_ICON = `<svg viewBox="0 0 24 24"><path d="M9 3 5 21"/><path d="m15 3 4 18"/><path d="M12 8v3M12 14v3"/></svg>`;

/** Km del mes natural: calendario. */
const ACHIEVEMENT_MONTHLY_ICON = `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>`;

/** Número de rutas grabadas: pila de capas. */
const ACHIEVEMENT_COUNT_ICON = `<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/></svg>`;

/** Duración de una ruta (ruta larga): cronómetro. */
const ACHIEVEMENT_DURATION_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>`;

/** Icono correspondiente al tipo de requisito de un logro, para mostrar en su tarjeta/animación. */
export function achievementIconFor(requirementType: AchievementRequirementType): string {
  switch (requirementType) {
    case 'total_distance_km':
      return ACHIEVEMENT_DISTANCE_ICON;
    case 'monthly_distance_km':
      return ACHIEVEMENT_MONTHLY_ICON;
    case 'route_count':
      return ACHIEVEMENT_COUNT_ICON;
    case 'single_route_duration_seconds':
      return ACHIEVEMENT_DURATION_ICON;
  }
}
