/**
 * Cabecera de `<route-detail>`: título, icono de favorito, icono de
 * sincronización y fecha. Extraído de route-detail.element.ts para mantener
 * ese archivo bajo el límite de tamaño (specs/ui/frontend-conventions.md) —
 * mismo patrón que route-detail-notes.ts/route-detail-timeline.ts.
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import { buildSyncIconButton } from './route-detail-cloud-upload.js';
import { buildRouteDetailFavoriteIcon } from './route-detail-favorite.js';
import { buildShareButton } from './route-detail-share.js';

export interface DetailHeaderOptions {
  route: Route;
  repository: IRouteRepository | null;
  session: Session | null;
  /** "Subir a la nube" solo tiene sentido para una ruta de origen local (AC de la spec `route-cloud-sync`). */
  isLocalRoute: boolean;
  isSynced: boolean;
  /** "Compartir" solo tiene sentido si la ruta ya existe en el servidor —
   * `isSynced` (ruta local ya subida) o una ruta exclusiva de la nube (nunca
   * local, ver design.md D2 de `compartir-ruta`). */
  existsOnServer: boolean;
  onFavoriteToggled: () => void;
  onUploaded: () => void;
}

/** Construye la cabecera de `<route-detail>` (ver JSDoc del módulo). */
export function buildDetailHeader(options: DetailHeaderOptions): DocumentFragment {
  const { route, repository, session, isLocalRoute, isSynced, existsOnServer, onFavoriteToggled, onUploaded } = options;
  const fragment = document.createDocumentFragment();

  const titleRow = document.createElement('div');
  titleRow.className = 'detail-title-row';

  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.setAttribute('data-cy', 'route-detail-title');
  title.textContent = buildRouteDisplayName(route.name, route.createdAt);
  titleRow.appendChild(title);

  if (repository) {
    titleRow.appendChild(buildRouteDetailFavoriteIcon({ repository, route, session, onToggled: onFavoriteToggled }));
  }

  if (session && isLocalRoute && repository) {
    titleRow.appendChild(buildSyncIconButton({
      apiBaseUrl: getApiBaseUrl(), session, repository, route, isSynced, onUploaded,
    }));
  }

  if (session && existsOnServer) {
    titleRow.appendChild(buildShareButton({ apiBaseUrl: getApiBaseUrl(), session, routeId: route.id }));
  }

  fragment.appendChild(titleRow);

  const date = document.createElement('p');
  date.className = 'detail-date';
  date.textContent = formatRouteDate(route.createdAt);
  fragment.appendChild(date);

  return fragment;
}
