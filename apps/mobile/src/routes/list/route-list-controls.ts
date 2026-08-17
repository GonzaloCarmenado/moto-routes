/**
 * Construcción de las dos filas de controles de la cabecera de
 * `<route-list>` (iconos de filtro + buscador/orden). Extraído de
 * route-list.element.ts para mantener ese archivo bajo el límite de tamaño
 * del proyecto (mejoras-listado-rutas, design.md Risk "límite de líneas") —
 * mismo patrón que route-list-favorite.ts/route-list-sharing.ts.
 */
import { buildSharingButton } from './route-list-sharing.js';
import { buildFavoritesFilterToggle } from './route-list-favorite.js';
import { buildLocalOnlyFilterToggle, buildCloudOnlyFilterToggle } from './route-list-sync-filters.js';
import type { ListSortBy } from './route-list-filters.transform.js';

export interface ControlsRowOptions {
  hasSession: boolean;
  hasItems: boolean;
  /** Número de invitaciones recibidas pendientes (contador-invitaciones-pendientes) — 0 si ninguna. */
  hasPendingShares: number;
  showFavoritesOnly: boolean;
  showLocalOnly: boolean;
  showCloudOnly: boolean;
  /** Invocado al pulsar el icono de favoritas — el llamador decide cómo re-renderizar. */
  onToggleFavorites: () => void;
  /** Invocado al pulsar el icono "Solo locales". */
  onToggleLocal: () => void;
  /** Invocado al pulsar el icono "Solo en la nube". */
  onToggleCloud: () => void;
}

/**
 * Fila de iconos-toggle: invitaciones, favoritas, local, nube — `null` si
 * ninguno aplica (sin sesión y sin rutas). Local/nube solo con sesión activa:
 * sin sesión no existe el concepto de sincronización (mismo criterio que el
 * badge por tarjeta de route-cloud-sync).
 */
export function buildControlsRow(options: ControlsRowOptions): HTMLElement | null {
  const row = document.createElement('div');
  row.className = 'route-list__controls-row';

  if (options.hasSession) {
    row.appendChild(buildSharingButton(options.hasPendingShares));
  }

  if (options.hasItems) {
    row.appendChild(buildFavoritesFilterToggle(options.showFavoritesOnly, options.onToggleFavorites));

    if (options.hasSession) {
      row.appendChild(buildLocalOnlyFilterToggle(options.showLocalOnly, options.onToggleLocal));
      row.appendChild(buildCloudOnlyFilterToggle(options.showCloudOnly, options.onToggleCloud));
    }
  }

  return row.childElementCount > 0 ? row : null;
}

export interface SearchSortRowOptions {
  searchQuery: string;
  sortBy: ListSortBy;
  /** Invocado en cada tecla escrita en el buscador, con el valor actual del campo. */
  onSearchInput: (value: string) => void;
  /** Invocado al pulsar el control de orden, para alternar entre fecha y nombre. */
  onToggleSort: () => void;
}

/** Fila del buscador por nombre + control de orden fecha/nombre. */
export function buildSearchSortRow(options: SearchSortRowOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = 'route-list__search-row';
  row.appendChild(buildSearchInput(options));
  row.appendChild(buildSortToggle(options));
  return row;
}

/**
 * `onSearchInput` debe disparar solo una actualización parcial del listado
 * (no un `render()` completo), o este mismo `<input>` se destruiría y
 * recrearía en cada tecla — perdiendo el foco a partir del segundo carácter
 * escrito. Ver JSDoc de `route-list.element.ts::updateBodyOnly` (gap real
 * encontrado implementando, no anticipado en design.md).
 */
function buildSearchInput(options: SearchSortRowOptions): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'route-list__search';
  input.setAttribute('data-cy', 'route-list-buscador');
  input.setAttribute('aria-label', 'Buscar ruta por nombre');
  input.placeholder = 'Buscar por nombre…';
  input.value = options.searchQuery;
  input.addEventListener('input', () => { options.onSearchInput(input.value); });
  return input;
}

function buildSortToggle(options: SearchSortRowOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sort-toggle';
  btn.setAttribute('data-cy', 'route-list-orden');
  const label = options.sortBy === 'date' ? 'Fecha' : 'Nombre';
  btn.setAttribute('aria-label', `Ordenado por ${label.toLowerCase()}, pulsar para cambiar`);
  btn.textContent = label;
  btn.addEventListener('click', options.onToggleSort);
  return btn;
}
