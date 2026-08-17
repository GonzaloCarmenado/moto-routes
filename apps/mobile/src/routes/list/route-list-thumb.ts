/**
 * Miniatura de una tarjeta del listado: silueta SVG si la ruta ya tiene
 * `previewPolyline`, o el placeholder de franjas con backfill perezoso en
 * segundo plano. Extraído de route-list.element.ts para mantener ese
 * archivo bajo el límite de tamaño del proyecto (mejoras-listado-rutas,
 * design.md Risk "límite de líneas") — mismo patrón que
 * route-list-favorite.ts/route-list-controls.ts.
 */
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import { buildPolylineSvgPath } from './route-list.transform.js';
import { ensurePreviewPolyline } from './route-list-polyline.service.js';
import type { RouteListItem } from './route-list-sync.transform.js';

const THUMB_TRACE_SIZE = 72;

/**
 * Construye el `.thumb` de la tarjeta: la silueta SVG si `route` ya tiene
 * `previewPolyline` disponible, o el placeholder de franjas existente. En
 * este último caso, si la ruta aún no tiene el trazado calculado (`null`),
 * dispara el backfill perezoso en segundo plano (sin bloquear el render).
 */
export function buildThumb(item: RouteListItem, card: HTMLElement, repository: IRouteRepository | null): HTMLElement {
  const { route, syncState } = item;
  const svgPath = buildPolylineSvgPath(route.previewPolyline, THUMB_TRACE_SIZE, THUMB_TRACE_SIZE);
  if (svgPath) return buildTraceThumb(svgPath);

  // Una ruta exclusiva de la nube no tiene puntos locales de los que
  // calcular el trazado — el backfill solo tiene sentido para rutas con
  // datos en el repositorio local.
  if (route.previewPolyline === null && syncState !== 'cloud-only') {
    scheduleBackfill(route, card, repository);
  }
  return buildPlaceholderThumb();
}

function buildPlaceholderThumb(): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = 'thumb media-placeholder';
  return thumb;
}

function buildTraceThumb(pathD: string): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = 'thumb thumb--trace';

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(THUMB_TRACE_SIZE)} ${String(THUMB_TRACE_SIZE)}`);

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('data-cy', 'route-card-trace');
  svg.appendChild(path);

  thumb.appendChild(svg);
  return thumb;
}

/**
 * Lanza `ensurePreviewPolyline` sin `await` (el placeholder ya se ha
 * pintado) y, si resuelve con un trazado, sustituye el `.thumb` de esa
 * tarjeta concreta in-place y actualiza `route.previewPolyline` en memoria
 * para que una re-renderización posterior no vuelva a mostrar el placeholder.
 */
function scheduleBackfill(route: Route, card: HTMLElement, repository: IRouteRepository | null): void {
  if (!repository) return;

  void ensurePreviewPolyline(repository, route)
    .then((polyline) => {
      if (!polyline) return;
      route.previewPolyline = polyline;

      const svgPath = buildPolylineSvgPath(polyline, THUMB_TRACE_SIZE, THUMB_TRACE_SIZE);
      if (!svgPath) return;
      card.querySelector('.thumb')?.replaceWith(buildTraceThumb(svgPath));
    })
    .catch(() => {
      // Backfill best-effort: si falla, la tarjeta sigue en placeholder
      // hasta la próxima carga del listado — preview_polyline es un dato
      // derivado y recalculable, nunca la fuente de verdad.
    });
}
