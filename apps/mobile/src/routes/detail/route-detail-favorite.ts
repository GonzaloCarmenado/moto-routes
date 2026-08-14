/**
 * Icono de favorito de `<route-detail>`: construcción del DOM y manejo del
 * toggle. Extraído de route-detail.element.ts para mantener ese archivo bajo
 * el límite de tamaño (specs/ui/frontend-conventions.md), mismo patrón que
 * route-detail-cloud-upload.ts.
 *
 * Requiere sesión activa (favoritos-rutas, a diferencia de las notas, que no
 * la exigen) — ligado a la cuenta, no al dispositivo. Misma limitación ya
 * existente en notas para una ruta exclusiva de la nube (nunca guardada
 * localmente): `updateFavorite()` es un no-op silencioso en ese caso, no
 * arreglado aquí (fuera de alcance de este cambio).
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import { buildFavoriteToggle } from '../../shared/favorite-toggle.js';

export interface FavoriteIconOptions {
  repository: IRouteRepository;
  route: Route;
  session: Session | null;
  /** Invocado tras un toggle con éxito, para que el llamador dispare la re-sincronización y vuelva a renderizar. */
  onToggled: () => void;
}

/** Construye el icono de favorito de la cabecera de detalle (ver JSDoc del módulo). */
export function buildRouteDetailFavoriteIcon(options: FavoriteIconOptions): HTMLElement {
  const { repository, route, session, onToggled } = options;
  return buildFavoriteToggle({
    isFavorite: route.isFavorite,
    onToggle: session ? (): void => { void handleToggleFavorite(repository, route, onToggled); } : null,
    dataCy: 'route-detail-btn-favorito',
  });
}

async function handleToggleFavorite(repository: IRouteRepository, route: Route, onToggled: () => void): Promise<void> {
  const isFavorite = !route.isFavorite;
  await repository.updateFavorite(route.id, isFavorite);
  route.isFavorite = isFavorite;
  onToggled();
}
