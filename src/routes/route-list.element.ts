import styles from './route-list.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';

class RouteList extends HTMLElement {
  private _repository: IRouteRepository | null = null;

  set repository(repo: IRouteRepository | null) {
    this._repository = repo;
    if (repo) void this.fetchAndRender();
  }

  get repository(): IRouteRepository | null {
    return this._repository;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (this._repository) {
      void this.fetchAndRender();
    }
  }

  private async fetchAndRender(): Promise<void> {
    if (!this._repository) return;
    const routes = await this._repository.getAll();
    this.render(routes);
  }

  private render(routes: Route[]): void {
    const style = document.createElement('style');
    style.textContent = styles;

    const screen = document.createElement('div');
    screen.className = 'route-list';

    // Title
    const title = document.createElement('h1');
    title.className = 'route-list__title';
    title.textContent = 'Tus rutas';
    screen.appendChild(title);

    // Subtitle
    const totalKm = routes.reduce((sum, r) => sum + r.totalDistance, 0);
    const subtitle = document.createElement('p');
    subtitle.className = 'route-list__subtitle';
    subtitle.textContent = `${String(routes.length)} rutas guardadas · ${totalKm.toFixed(1)} km recorridos`;
    screen.appendChild(subtitle);

    if (routes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'route-list__empty';
      empty.textContent = 'No hay rutas guardadas todavía';
      screen.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'route-list__cards';
      for (const route of routes) {
        list.appendChild(this.buildCard(route));
      }
      screen.appendChild(list);
    }

    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(style);
    root.appendChild(screen);
  }

  private buildCard(route: Route): HTMLElement {
    const card = document.createElement('div');
    card.className = 'route-card';

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