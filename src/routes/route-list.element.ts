import styles from './route-list.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';

class RouteList extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _routes: Route[] = [];

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
    this._routes = await this._repository.getAll();
    this.render();
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.className = 'route-list';
    screen.appendChild(this.buildHeader(this._routes));
    screen.appendChild(this.buildBody(this._routes));

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
    return card;
  }
}

customElements.define('route-list', RouteList);