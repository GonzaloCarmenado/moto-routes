/**
 * Iconos SVG (inline, `stroke="currentColor"`) de cada tipo de parada del
 * catálogo de `apps/api` (mismo estilo que `cloud-sync-icons.ts`), indexados
 * por `key` — el identificador estable del catálogo, nunca por el emoji ni
 * por el texto (que pueden cambiar sin requerir una release de la app).
 * Reemplaza el renderizado directo del emoji del catálogo (revierte
 * parcialmente ADR-035, ver memory/decisions.md).
 */

/** Bar / restaurante. */
const BAR_RESTAURANTE_ICON = `<svg viewBox="0 0 24 24"><path d="M7 2v7a2 2 0 0 0 2 2v11"/><path d="M7 2v20"/><path d="M11 2v9"/><path d="M17 2c-1.5 0-3 1.5-3 4v4a2 2 0 0 0 2 2v9"/></svg>`;

/** Mirador. */
const MIRADOR_ICON = `<svg viewBox="0 0 24 24"><path d="m3 20 6-11 4 6 3-4 5 9z"/><circle cx="7" cy="7" r="2"/></svg>`;

/** Monumento. */
const MONUMENTO_ICON = `<svg viewBox="0 0 24 24"><path d="M4 21h16"/><path d="M6 21V9M10 21V9M14 21V9M18 21V9"/><path d="m3 9 9-5 9 5"/></svg>`;

/** Gasolinera. */
const GASOLINERA_ICON = `<svg viewBox="0 0 24 24"><path d="M4 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15"/><path d="M4 21h9"/><path d="M13 10h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>`;

/** Alojamiento. */
const ALOJAMIENTO_ICON = `<svg viewBox="0 0 24 24"><path d="M3 18v-8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/><path d="M3 18v3"/><path d="M21 21v-6a2 2 0 0 0-2-2H5"/><path d="M21 18v3"/><circle cx="7" cy="11" r="1"/></svg>`;

/** Taller / mecánico. */
const TALLER_MECANICO_ICON = `<svg viewBox="0 0 24 24"><path d="M14.5 3.5a4 4 0 0 0-5.4 4.9L3 14.5 5.5 17l6.1-6.1a4 4 0 0 0 4.9-5.4l-2.6 2.6-2-2z"/></svg>`;

/** Aparcamiento. */
const APARCAMIENTO_ICON = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 16V8h4a2.5 2.5 0 0 1 0 5H9"/></svg>`;

/** Otro. */
const OTRO_ICON = `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;

/** Mapeo de `key` del catálogo de tipos de parada (`apps/api`) a su icono SVG. */
export const STOP_TYPE_ICON_BY_KEY: Record<string, string> = {
  'bar-restaurante': BAR_RESTAURANTE_ICON,
  mirador: MIRADOR_ICON,
  monumento: MONUMENTO_ICON,
  gasolinera: GASOLINERA_ICON,
  alojamiento: ALOJAMIENTO_ICON,
  'taller-mecanico': TALLER_MECANICO_ICON,
  aparcamiento: APARCAMIENTO_ICON,
  otro: OTRO_ICON,
};

/** Icono de repuesto para un `key` del catálogo sin icono específico todavía en el cliente. */
export const STOP_TYPE_ICON_FALLBACK = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="16.5" r="0.1"/></svg>`;

/** Resuelve el icono SVG de un tipo de parada a partir de su `key`, con repuesto para claves no mapeadas. */
export function resolveStopTypeIcon(key: string): string {
  return STOP_TYPE_ICON_BY_KEY[key] ?? STOP_TYPE_ICON_FALLBACK;
}
