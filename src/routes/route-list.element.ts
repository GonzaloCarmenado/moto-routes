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
    if (routes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'route-list__empty';
      empty.textContent = 'No hay rutas guardadas todavía';
      return empty;
    }

    const list = document.createElement('div');
    list.className = 'route-list__cards';
    for (const route of routes) {
      list.appendChild(this.buildCard(route));
    }
    return list;
  }

  private buildCard(route: Route): HTMLElement {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.addEventListener('click', () => {
      dispatchAppEvent(APP_EVENTS.VIEW_ROUTE, { routeId: route.id });
    });

    const thumb = document.createElement('div');
    thumb.className = 'thumb media-placeholder';
    card.appendChild(thumb);

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