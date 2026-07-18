import styles from './route-detail.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';

class RouteDetail extends HTMLElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;

  set repository(repo: IRouteRepository | null) {
    this._repository = repo;
  }

  get repository(): IRouteRepository | null {
    return this._repository;
  }

  set routeId(id: string | null) {
    this._routeId = id;
    if (this.isConnected) void this.fetchAndRender();
  }

  get routeId(): string | null {
    return this._routeId;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (this._repository && this._routeId) {
      void this.fetchAndRender();
    }
  }

  private async fetchAndRender(): Promise<void> {
    if (!this._repository || !this._routeId) return;
    const route = await this._repository.getById(this._routeId);
    this.render(route);
  }

  private render(route: Route | null): void {
    const style = document.createElement('style');
    style.textContent = styles;

    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(style);

    if (!route) {
      const empty = document.createElement('div');
      empty.className = 'empty-msg';
      empty.textContent = 'Ruta no encontrada';
      root.appendChild(empty);
      return;
    }

    const detail = document.createElement('div');
    detail.className = 'route-detail';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.innerHTML = '<span style="font-size:18px;">&larr;</span> Volver';
    backBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('back-to-list'));
    });
    detail.appendChild(backBtn);

    // Map
    detail.appendChild(this.buildMap());

    // Content
    const content = document.createElement('div');
    content.className = 'detail-content';

    const title = document.createElement('h1');
    title.className = 'detail-title';
    title.textContent = `Ruta ${route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}`;
    content.appendChild(title);

    const date = document.createElement('p');
    date.className = 'detail-date';
    date.textContent = route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    content.appendChild(date);

    // Stats grid
    const grid = document.createElement('div');
    grid.className = 'stat-grid cols-2';
    grid.innerHTML = `
      <div class="stat-tile"><span class="stat-label">Distancia</span><span class="stat-value">${route.totalDistance.toFixed(1)} <span class="stat-unit">km</span></span></div>
      <div class="stat-tile"><span class="stat-label">Duración</span><span class="stat-value">${formatDuration(route.duration)}</span></div>
      <div class="stat-tile"><span class="stat-label">Vel. media</span><span class="stat-value">${route.avgSpeed.toFixed(0)} <span class="stat-unit">km/h</span></span></div>
      <div class="stat-tile"><span class="stat-label">Desnivel</span><span class="stat-value">-- <span class="stat-unit">m</span></span></div>
    `;
    content.appendChild(grid);

    // Chart
    const chart = document.createElement('div');
    chart.className = 'route-chart';
    chart.innerHTML = '<div class="chart-label">Velocidad durante la ruta</div><div class="chart-area">(próximamente)</div>';
    content.appendChild(chart);

    // Photos
    const photosLabel = document.createElement('div');
    photosLabel.className = 'section-label';
    photosLabel.textContent = 'Fotos de la ruta';
    content.appendChild(photosLabel);

    const photos = document.createElement('div');
    photos.className = 'photo-placeholder';
    photos.textContent = 'Sin fotos';
    content.appendChild(photos);

    detail.appendChild(content);
    root.appendChild(detail);
  }

  private buildMap(): HTMLElement {
    const map = document.createElement('div');
    map.className = 'route-map';
    map.innerHTML = `
      <svg viewBox="0 0 390 200" preserveAspectRatio="xMidYMid meet">
        <path d="M 20 180 C 70 130, 50 70, 110 60 S 210 100, 200 30 S 300 10, 320 0" fill="none" stroke="var(--amber)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 14" />
        <circle cx="20" cy="180" r="7" fill="oklch(60% 0.1 90)" />
        <circle cx="320" cy="0" r="7" fill="var(--amber)" />
      </svg>
      <span class="map-tag">mapa de la ruta</span>
    `;
    return map;
  }
}

customElements.define('route-detail', RouteDetail);