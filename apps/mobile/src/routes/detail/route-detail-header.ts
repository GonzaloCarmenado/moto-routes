/**
 * Cabecera de `<route-detail>`: título, icono de favorito, icono de
 * sincronización y fecha. Extraído de route-detail.element.ts para mantener
 * ese archivo bajo el límite de tamaño (specs/ui/frontend-conventions.md) —
 * mismo patrón que route-detail-notes.ts/route-detail-timeline.ts.
 *
 * La fila de acciones son solo iconos, sin etiqueta de texto (revisión de
 * diseño: con 4 acciones, las etiquetas producían pills de ancho desigual
 * que rompían mal de línea). Favorito/Subir ya comunican su estado con el
 * propio icono (relleno/color) y Compartir es un icono universal; cada
 * botón sigue llevando su `aria-label` para accesibilidad.
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import { buildSyncIconButton } from './route-detail-cloud-upload.js';
import { buildExportButton } from './route-detail-export.js';
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
  /** true si queda alguna foto local sin subir todavía — deshabilita
   * "Compartir" en vez de clonar la ruta sin sus fotos en silencio (ver
   * JSDoc de route-detail-share.ts). */
  hasPendingPhotos: boolean;
  onFavoriteToggled: () => void;
  onUploaded: () => void;
}

/** Construye la fila de acciones (favorito/nube/compartir/exportar), separada del título — ver JSDoc del módulo. */
function buildActionsRow(options: DetailHeaderOptions): HTMLElement {
  const { route, repository, session, isLocalRoute, isSynced, existsOnServer, hasPendingPhotos, onFavoriteToggled, onUploaded } = options;
  const actionsRow = document.createElement('div');
  actionsRow.className = 'detail-actions-row';

  if (repository) {
    const favoriteBtn = buildRouteDetailFavoriteIcon({ repository, route, session, onToggled: onFavoriteToggled });
    actionsRow.appendChild(favoriteBtn);
  }

  if (session && isLocalRoute && repository) {
    const syncBtn = buildSyncIconButton({
      apiBaseUrl: getApiBaseUrl(), session, repository, route, isSynced, onUploaded,
    });
    actionsRow.appendChild(syncBtn);
  }

  if (session && existsOnServer) {
    const shareBtn = buildShareButton({ apiBaseUrl: getApiBaseUrl(), session, routeId: route.id, disabled: hasPendingPhotos });
    actionsRow.appendChild(shareBtn);

    const exportBtn = buildExportButton({ apiBaseUrl: getApiBaseUrl(), session, routeId: route.id });
    actionsRow.appendChild(exportBtn);
  }

  return actionsRow;
}

/** Construye la cabecera de `<route-detail>` (ver JSDoc del módulo). */
export function buildDetailHeader(options: DetailHeaderOptions): DocumentFragment {
  const { route } = options;
  const fragment = document.createDocumentFragment();

  const titleRow = document.createElement('div');
  titleRow.className = 'detail-title-row';

  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.setAttribute('data-cy', 'route-detail-title');
  title.textContent = buildRouteDisplayName(route.name, route.createdAt);
  titleRow.appendChild(title);
  fragment.appendChild(titleRow);

  const date = document.createElement('p');
  date.className = 'detail-date';
  date.textContent = formatRouteDate(route.createdAt);
  fragment.appendChild(date);

  const actionsRow = buildActionsRow(options);
  if (actionsRow.childElementCount > 0) fragment.appendChild(actionsRow);

  return fragment;
}
