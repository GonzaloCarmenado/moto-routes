/**
 * Filtrado y orden combinados del listado de rutas: favoritas, local/nube,
 * búsqueda por nombre y orden fecha/nombre — extraído para mantener
 * route-list.element.ts bajo el límite de tamaño del proyecto (design.md
 * Decisión 2 de mejoras-listado-rutas). Pura: sin efectos, sin DOM.
 */
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import type { RouteListItem } from './route-list-sync.transform.js';

/** Criterio de orden del listado: fecha (por defecto) o nombre alfabético. */
export type ListSortBy = 'date' | 'name';

/** Estado combinado de los 5 controles del listado (design.md Decisión 1). */
export interface ListControls {
  showFavoritesOnly: boolean;
  showLocalOnly: boolean;
  showCloudOnly: boolean;
  searchQuery: string;
  sortBy: ListSortBy;
}

function displayName(item: RouteListItem): string {
  return buildRouteDisplayName(item.route.name, item.route.createdAt);
}

/**
 * Aplica favoritas → local/nube → búsqueda → orden, en ese orden, sobre la
 * lista ya fusionada local+nube. La búsqueda y el orden por nombre usan el
 * nombre mostrado al usuario (`buildRouteDisplayName`), no `route.name` en
 * crudo — puede ser `null` en rutas sin nombre propio.
 */
export function applyListControls(items: RouteListItem[], controls: ListControls): RouteListItem[] {
  let result = items;

  if (controls.showFavoritesOnly) result = result.filter((i) => i.route.isFavorite);
  if (controls.showLocalOnly) result = result.filter((i) => i.syncState === 'local');
  if (controls.showCloudOnly) result = result.filter((i) => i.syncState === 'synced' || i.syncState === 'cloud-only');

  const query = controls.searchQuery.trim().toLowerCase();
  if (query) result = result.filter((i) => displayName(i).toLowerCase().includes(query));

  return sortItems(result, controls.sortBy);
}

function sortItems(items: RouteListItem[], sortBy: ListSortBy): RouteListItem[] {
  const sorted = [...items];
  if (sortBy === 'name') {
    sorted.sort((a, b) => displayName(a).localeCompare(displayName(b), 'es', { sensitivity: 'base' }));
  } else {
    sorted.sort((a, b) => b.route.createdAt.localeCompare(a.route.createdAt));
  }
  return sorted;
}
