/**
 * Estados no interactivos de <route-detail> (cargando / no encontrada / error
 * de red al descargar una ruta de la nube). Extraído de route-detail.element.ts
 * para mantener ese archivo bajo el límite de tamaño (specs/ui/frontend-conventions.md).
 */

/** Se muestra mientras `fetchAndRender()` está en marcha (AC-010). */
export function buildLoadingState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-msg';
  el.setAttribute('data-cy', 'route-detail-loading');
  el.textContent = 'Cargando ruta…';
  return el;
}

/** Ni local ni en la nube (o sin sesión para comprobarlo). */
export function buildEmptyMessage(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'empty-msg';
  empty.textContent = 'Ruta no encontrada';
  return empty;
}

/** Fallo al descargar una ruta exclusiva de la nube (p. ej. sin conexión) —
 * mensaje explícito en vez de dejar la pantalla en blanco o confundirlo con
 * "ruta no encontrada" (AC de la spec `route-cloud-sync`). */
export function buildLoadErrorMessage(message: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-msg';
  el.setAttribute('data-cy', 'route-detail-load-error');
  el.textContent = `⚠️ ${message}`;
  return el;
}
