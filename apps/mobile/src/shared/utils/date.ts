/**
 * Formateo de fecha compartido entre `route-list`, `route-detail` y
 * `route-naming.ts` (ver AC-003 de `specs/features/deuda-tecnica-auditoria.md`).
 * Formato unificado: día numérico, mes abreviado, año — mismo criterio ya
 * usado en `route-list` y en `buildDefaultRouteName`.
 */

/**
 * Formatea una fecha ISO como "27 jul 2026" (es-ES). Devuelve `''` si no
 * hay fecha disponible.
 */
export function formatRouteDate(dateIso: string | undefined): string {
  if (!dateIso) return '';
  return new Date(dateIso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
