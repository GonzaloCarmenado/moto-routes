/**
 * Icono de favorito por card y toggle del filtro "Solo favoritas" de
 * `<route-list>`. Extraído de route-list.element.ts para mantener ese
 * archivo bajo el límite de tamaño del proyecto, mismo patrón que
 * route-detail-favorite.ts/route-detail-header.ts.
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Session } from '../../shared/models/session.types.js';
import { buildFavoriteToggle } from '../../shared/favorite-toggle.js';
import { triggerAutoResync } from '../detail/route-detail-sync-triggers.js';
import type { RouteListItem } from './route-list-sync.transform.js';

export interface FavoriteCardIconOptions {
  repository: IRouteRepository;
  session: Session | null;
  item: RouteListItem;
  /** Invocado tras un toggle con éxito, para que el llamador vuelva a renderizar. */
  onToggled: () => void;
}

/** Construye el icono de favorito de una card del listado (ver JSDoc del módulo). */
export function buildRouteCardFavoriteIcon(options: FavoriteCardIconOptions): HTMLElement {
  const { repository, session, item, onToggled } = options;
  return buildFavoriteToggle({
    isFavorite: item.route.isFavorite,
    onToggle: session ? (): void => { void handleToggleFavorite(repository, session, item, onToggled); } : null,
    dataCy: 'route-card-btn-favorito',
  });
}

async function handleToggleFavorite(
  repository: IRouteRepository,
  session: Session | null,
  item: RouteListItem,
  onToggled: () => void,
): Promise<void> {
  const { route, syncState } = item;
  const isFavorite = !route.isFavorite;
  await repository.updateFavorite(route.id, isFavorite);
  route.isFavorite = isFavorite;
  triggerAutoResync({ session, routeId: route.id, repository, isSynced: syncState === 'synced' }, route);
  onToggled();
}

/** Construye el botón del filtro "Solo favoritas" (design.md D7, ver JSDoc del módulo). */
export function buildFavoritesFilterToggle(active: boolean, onToggle: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'favorites-filter';
  btn.classList.toggle('favorites-filter--active', active);
  btn.setAttribute('data-cy', 'route-list-filtro-favoritas');
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.textContent = 'Solo favoritas';
  btn.addEventListener('click', onToggle);
  return btn;
}
