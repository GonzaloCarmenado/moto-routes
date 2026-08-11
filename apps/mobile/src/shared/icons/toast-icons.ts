/**
 * Iconos SVG (inline, `stroke="currentColor"`) de los toasts de feedback —
 * mismo estilo que `cloud-sync-icons.ts`. `info` (progreso) no lleva icono,
 * sin cambio de comportamiento respecto a antes de este cambio.
 */

/** Toast de éxito. */
export const TOAST_SUCCESS_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/></svg>`;

/** Toast de error. */
export const TOAST_ERROR_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.1"/></svg>`;
