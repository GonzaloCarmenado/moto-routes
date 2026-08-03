/**
 * Utilidades de formateo/cálculo puras, compartidas por `cockpit` y `routes`
 * (ver AC-001 de `specs/features/deuda-tecnica-auditoria.md`).
 */

/**
 * Formatea segundos a formato MM:SS o HH:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calcula la velocidad media en km/h.
 */
export function calculateAvgSpeed(distanceKm: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0;
  return (distanceKm / timeSeconds) * 3600;
}
