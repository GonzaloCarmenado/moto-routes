/** A partir de este número el badge muestra "9+" en vez del valor exacto, para no romper el hitbox del icono. */
const BADGE_MAX_EXACT = 9;

/**
 * Texto del badge de solicitudes de amistad pendientes recibidas — `null`
 * sin ninguna pendiente (sin badge), el número exacto hasta 9, "9+" por
 * encima. Mismo criterio que `route-list-sharing.ts::buildPendingBadge`.
 */
export function formatPendingBadge(pendingCount: number): string | null {
  if (pendingCount <= 0) return null;
  return pendingCount > BADGE_MAX_EXACT ? `${String(BADGE_MAX_EXACT)}+` : String(pendingCount);
}
