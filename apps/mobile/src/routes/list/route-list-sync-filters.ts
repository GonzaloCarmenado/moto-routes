/**
 * Filtros toggle "Solo locales" / "Solo en la nube" de la cabecera de
 * `<route-list>`, basados en `RouteSyncState`. Extraído de
 * route-list.element.ts para mantener ese archivo bajo el límite de tamaño
 * del proyecto, mismo patrón que route-list-favorite.ts/route-list-sharing.ts.
 */
import { DEVICE_ICON, CLOUD_ONLY_ICON } from '../../shared/icons/cloud-sync-icons.js';

interface SyncFilterToggleOptions {
  active: boolean;
  icon: string;
  dataCy: string;
  label: string;
  onToggle: () => void;
}

function buildSyncFilterToggle(options: SyncFilterToggleOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Mismo patrón .favorite-icon que el resto de iconos-toggle de la cabecera
  // (favoritas, invitaciones) — consistencia visual, ver design.md Decisión 7.
  btn.className = 'favorite-icon';
  btn.classList.toggle('favorite-icon--active', options.active);
  btn.setAttribute('data-cy', options.dataCy);
  btn.setAttribute('aria-pressed', options.active ? 'true' : 'false');
  btn.setAttribute('aria-label', options.label);
  btn.innerHTML = options.icon;
  btn.addEventListener('click', options.onToggle);
  return btn;
}

/** Construye el botón del filtro "Solo locales" (rutas no sincronizadas con la nube). */
export function buildLocalOnlyFilterToggle(active: boolean, onToggle: () => void): HTMLButtonElement {
  return buildSyncFilterToggle({ active, icon: DEVICE_ICON, dataCy: 'route-list-filtro-locales', label: 'Solo locales', onToggle });
}

/** Construye el botón del filtro "Solo en la nube" (rutas sincronizadas o exclusivas de la nube). */
export function buildCloudOnlyFilterToggle(active: boolean, onToggle: () => void): HTMLButtonElement {
  return buildSyncFilterToggle({ active, icon: CLOUD_ONLY_ICON, dataCy: 'route-list-filtro-nube', label: 'Solo en la nube', onToggle });
}
