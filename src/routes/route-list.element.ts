import styles from './route-list.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import { createPhotoRepository } from '../shared/services/photo-storage.service.js';
import { deleteRouteAndPhotos } from '../shared/services/route-deletion.service.js';
import { confirmDialog } from '../shared/feedback/confirm-dialog.element.js';
import { showToast } from '../shared/feedback/toast.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { buildPolylineSvgPath } from './route-list.transform.js';
import { ensurePreviewPolyline } from './route-list-polyline.service.js';
import { injectTestData, removeTestData } from '../test-helpers/inject-test-data.js';

const THUMB_TRACE_SIZE = 72;

class RouteList extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _routes: Route[] = [];
  private _loading = false;
  private photoRepo: IPhotoRepository | null = null;

  private async getPhotoRepo(): Promise<IPhotoRepository> {
    this.photoRepo ??= await createPhotoRepository();
    return this.photoRepo;
  }

  set repository(repo: IRouteRepository | null) {
    this._repository = repo;
    if (repo) void this.fetchAndRender();
  }

  get repository(): IRouteRepository | null {
    return this._repository;
  }

  private readonly onNavRutas = (): void => { void this.fetchAndRender(); };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    window.addEventListener(APP_EVENTS.NAV_RUTAS, this.onNavRutas);
    if (this._repository) {
      void this.fetchAndRender();
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.NAV_RUTAS, this.onNavRutas);
  }

  private async fetchAndRender(): Promise<void> {
    if (!this._repository) return;
    this._loading = true;
    this.render();
    this._routes = await this._repository.getAll();
    this._loading = false;
    this.render();
  }

  private buildLoadingState(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'route-list__loading';
    el.setAttribute('data-cy', 'route-list-loading');
    el.textContent = 'Cargando rutas…';
    return el;
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.className = 'route-list';
    if (this._loading) {
      screen.appendChild(this.buildLoadingState());
    } else {
      screen.appendChild(this.buildHeader(this._routes));
      screen.appendChild(this.buildBody(this._routes));
    }

    this.renderShadow(styles, screen);
  }

  private buildHeader(routes: Route[]): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'route-list__title';
    title.textContent = 'Tus rutas';
    fragment.appendChild(title);

    const totalKm = routes.reduce((sum, r) => sum + r.totalDistance, 0);
    const subtitle = document.createElement('p');
    subtitle.className = 'route-list__subtitle';
    subtitle.textContent = `${String(routes.length)} rutas guardadas · ${totalKm.toFixed(1)} km recorridos`;
    fragment.appendChild(subtitle);

    return fragment;
  }

  private buildBody(routes: Route[]): HTMLElement {
    const container = document.createElement('div');

    // Panel debug TEMPORAL — visible siempre. Se elimina junto a inject-test-data.ts
    container.appendChild(this.buildDebugPanel());

    if (routes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'route-list__empty';
      empty.textContent = 'No hay rutas guardadas todavía';
      container.appendChild(empty);
      return container;
    }

    const list = document.createElement('div');
    list.className = 'route-list__cards';
    for (const route of routes) {
      list.appendChild(this.buildCard(route));
    }
    container.appendChild(list);
    return container;
  }

  private buildCard(route: Route): HTMLElement {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.dataset.routeId = route.id;
    card.addEventListener('click', () => {
      dispatchAppEvent(APP_EVENTS.VIEW_ROUTE, { routeId: route.id });
    });

    card.appendChild(this.buildThumb(route, card));

    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `Ruta ${route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`;
    info.appendChild(name);

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    info.appendChild(date);

    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.innerHTML = `<span class="badge distance">${route.totalDistance.toFixed(1)} km</span><span class="badge duration">${formatDuration(route.duration)}</span>`;
    info.appendChild(badges);

    card.appendChild(info);
    card.appendChild(this.buildDeleteButton(route));
    return card;
  }

  /**
   * Construye el `.thumb` de la tarjeta: la silueta SVG si `route` ya tiene
   * `previewPolyline` disponible, o el placeholder de franjas existente. En
   * este último caso, si la ruta aún no tiene el trazado calculado (`null`),
   * dispara el backfill perezoso en segundo plano (sin bloquear el render).
   */
  private buildThumb(route: Route, card: HTMLElement): HTMLElement {
    const svgPath = buildPolylineSvgPath(route.previewPolyline, THUMB_TRACE_SIZE, THUMB_TRACE_SIZE);
    if (svgPath) return this.buildTraceThumb(svgPath);

    if (route.previewPolyline === null) {
      this.scheduleBackfill(route, card);
    }
    return this.buildPlaceholderThumb();
  }

  private buildPlaceholderThumb(): HTMLElement {
    const thumb = document.createElement('div');
    thumb.className = 'thumb media-placeholder';
    return thumb;
  }

  private buildTraceThumb(pathD: string): HTMLElement {
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
   * (mutando el objeto que ya vive en `this._routes`) para que una
   * re-renderización posterior no vuelva a mostrar el placeholder.
   */
  private scheduleBackfill(route: Route, card: HTMLElement): void {
    const repo = this._repository;
    if (!repo) return;

    void ensurePreviewPolyline(repo, route)
      .then((polyline) => {
        if (!polyline) return;
        route.previewPolyline = polyline;

        const svgPath = buildPolylineSvgPath(polyline, THUMB_TRACE_SIZE, THUMB_TRACE_SIZE);
        if (!svgPath) return;
        card.querySelector('.thumb')?.replaceWith(this.buildTraceThumb(svgPath));
      })
      .catch(() => {
        // Backfill best-effort: si falla, la tarjeta sigue en placeholder
        // hasta la próxima carga del listado — preview_polyline es un dato
        // derivado y recalculable, nunca la fuente de verdad.
      });
  }

  /**
   * Panel debug con botones para inyectar/eliminar datos de prueba.
   * Solo visible si localStorage['debug'] está definido.
   * Se elimina junto a inject-test-data.ts tras la verificación.
   */
  private buildDebugPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = 'padding: 8px; background: #1a1a2e; border: 1px solid #ff8c00; border-radius: 8px; margin: 8px 0;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 11px; color: #ff8c00; margin-bottom: 4px;';
    title.textContent = '🧪 DEBUG MODE (localStorage.debug)';
    panel.appendChild(title);

    const btnInject = document.createElement('button');
    btnInject.textContent = '📥 Inyectar datos prueba';
    btnInject.style.cssText = 'background: #ff8c00; color: #000; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px;';
    btnInject.addEventListener('click', () => {
      void this.handleInjectTestData();
    });

    const btnRemove = document.createElement('button');
    btnRemove.textContent = '🗑 Eliminar datos prueba';
    btnRemove.style.cssText = 'background: #c0392b; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;';
    btnRemove.addEventListener('click', () => {
      void this.handleRemoveTestData();
    });

    panel.appendChild(btnInject);
    panel.appendChild(btnRemove);
    return panel;
  }

  private async handleInjectTestData(): Promise<void> {
    try {
      await injectTestData();
      showToast('🧪 Datos de prueba inyectados. Recarga el listado.', 'success');
      void this.fetchAndRender();
    } catch (err) {
      showToast(`⚠️ Error al inyectar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  private async handleRemoveTestData(): Promise<void> {
    try {
      await removeTestData();
      showToast('🧹 Datos de prueba eliminados.', 'success');
      void this.fetchAndRender();
    } catch (err) {
      showToast(`⚠️ Error al eliminar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  private buildDeleteButton(route: Route): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'route-card__delete';
    btn.setAttribute('data-cy', 'route-card-btn-eliminar');
    btn.setAttribute('aria-label', 'Eliminar ruta');
    btn.textContent = '🗑';
    btn.addEventListener('click', (event) => {
      // La tarjeta entera navega al detalle al pulsarla — evitar que el click
      // de "eliminar" también dispare esa navegación.
      event.stopPropagation();
      void this.handleDeleteRoute(route);
    });
    return btn;
  }

  private async handleDeleteRoute(route: Route): Promise<void> {
    const choice = await confirmDialog({
      title: 'Eliminar ruta',
      message: `Se eliminará esta ruta de ${route.totalDistance.toFixed(1)} km y todas sus fotos. Esta acción no se puede deshacer.`,
      actions: [
        { id: 'cancel', label: 'Cancelar', variant: 'neutral' },
        { id: 'confirm', label: 'Eliminar', variant: 'danger' },
      ],
    });
    if (choice !== 'confirm' || !this._repository) return;

    try {
      const photoRepo = await this.getPhotoRepo();
      await deleteRouteAndPhotos(this._repository, photoRepo, route.id);
    } catch (err) {
      showToast(`⚠️ ${toErrorMessage(err, 'Error al eliminar la ruta')}`, 'error');
      return;
    }
    this._routes = this._routes.filter((r) => r.id !== route.id);
    this.render();
    showToast('Ruta eliminada', 'success');
  }
}

customElements.define('route-list', RouteList);