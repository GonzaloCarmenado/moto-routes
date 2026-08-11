/**
 * Iconos SVG (inline, `stroke="currentColor"`) de las pestañas de la
 * navegación principal — mismo estilo que `cloud-sync-icons.ts`. El botón
 * "Grabar" no usa un icono de este módulo: mantiene su `record-dot` relleno
 * (indicador de acción, no icono de línea), con un fix de centrado protegido
 * por test de regresión (AC-018) — fuera de alcance de este cambio.
 */

/** Pestaña "Rutas" (listado). */
export const ROUTES_TAB_ICON = `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h12"/></svg>`;

/** Pestaña "Perfil". */
export const PROFILE_TAB_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`;
