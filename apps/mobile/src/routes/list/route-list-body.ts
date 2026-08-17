/**
 * Cuerpo del listado (tarjetas o estado vacío) y qué estado vacío mostrar
 * según los controles activos. Extraído de route-list.element.ts para
 * mantener ese archivo bajo el límite de tamaño del proyecto
 * (mejoras-listado-rutas, design.md Risk "límite de líneas") — mismo patrón
 * que route-list-favorite.ts/route-list-controls.ts.
 */
import { applyListControls, type ListControls } from './route-list-filters.transform.js';
import type { RouteListItem } from './route-list-sync.transform.js';

/** Construye las tarjetas visibles o el estado vacío correspondiente. */
export function buildListBody(
  items: RouteListItem[],
  controls: ListControls,
  buildCard: (item: RouteListItem) => HTMLElement,
): HTMLElement {
  if (items.length === 0) return buildEmptyState();

  const visible = applyListControls(items, controls);
  if (visible.length === 0) {
    return isOnlyFavoritesFilterActive(controls) ? buildEmptyFavoritesState() : buildEmptyFilteredState();
  }

  const list = document.createElement('div');
  list.className = 'route-list__cards';
  for (const item of visible) list.appendChild(buildCard(item));
  return list;
}

/**
 * Solo el filtro de favoritas activo, sin ningún otro control — es el único
 * caso que muestra el estado vacío específico "sin favoritas" (favoritos-rutas);
 * cualquier otra combinación vacía usa el estado vacío genérico de filtros
 * (mejoras-listado-rutas, design.md Decisión 3).
 */
function isOnlyFavoritesFilterActive(controls: ListControls): boolean {
  return controls.showFavoritesOnly && !controls.showLocalOnly && !controls.showCloudOnly && controls.searchQuery.trim() === '';
}

function buildEmptyState(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'route-list__empty';
  empty.setAttribute('data-cy', 'route-list-empty');
  empty.textContent = 'No hay rutas guardadas todavía';
  return empty;
}

function buildEmptyFavoritesState(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'route-list__empty';
  empty.setAttribute('data-cy', 'route-list-empty-favoritas');
  empty.textContent = 'No tienes rutas favoritas todavía';
  return empty;
}

/** Estado vacío genérico para cualquier combinación de filtros/búsqueda sin resultados. */
function buildEmptyFilteredState(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'route-list__empty';
  empty.setAttribute('data-cy', 'route-list-empty-filtrado');
  empty.textContent = 'No hay rutas que coincidan con los filtros aplicados';
  return empty;
}
