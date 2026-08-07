/**
 * Iconos SVG (inline, `stroke="currentColor"`) del estado de sincronización
 * con la nube de una ruta — compartidos entre `route-detail` (icono-acción
 * junto al título) y `route-list` (chip de estado sin texto), para que
 * "sincronizada" se vea igual en los dos sitios.
 */

/** Ruta que solo existe en este dispositivo, nunca subida. */
export const DEVICE_ICON = `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>`;

/** Ruta local sin sincronizar todavía — acción "subir a la nube". */
export const CLOUD_UPLOAD_ICON = `<svg viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><path d="M12 12v6"/><path d="M9.5 15.5 12 13l2.5 2.5"/></svg>`;

/** Ruta local que ya existe también en la nube. */
export const CLOUD_CHECK_ICON = `<svg viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><path d="m9.5 14.5 2 2 4-4.5"/></svg>`;

/** Ruta que solo existe en la nube, no en este dispositivo. */
export const CLOUD_ONLY_ICON = `<svg viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`;
