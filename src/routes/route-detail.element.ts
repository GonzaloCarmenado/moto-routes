import styles from './route-detail.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { Photo } from '../shared/models/photo.types.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';
import '../shared/route-map/route-map.element.js';
import '../photos/photo-capture.element.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../photos/photo-capture.types.js';
import { MemoryPhotoRepository } from '../shared/repositories/memory-photo.repository.js';
import { captureFromCamera, pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import { addPhotoToRoute } from './route-detail-photo.service.js';

/**
 * Tipo que asocia una foto con su URL de objeto para mostrar en UI.
 */
interface PhotoWithUrl extends Photo {
  objectUrl: string;
}

class RouteDetail extends HTMLElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;
  private readonly _photoRepo: IPhotoRepository = new MemoryPhotoRepository();
  private _photos: PhotoWithUrl[] = [];
  private _points: { lat: number; lng: number }[] = [];

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

  disconnectedCallback(): void {
    this.revokePhotoUrls();
  }

  private revokePhotoUrls(): void {
    for (const p of this._photos) {
      URL.revokeObjectURL(p.objectUrl);
    }
  }

  private async fetchAndRender(): Promise<void> {
    if (!this._repository || !this._routeId) return;
    const [route, points, photos] = await Promise.all([
      this._repository.getById(this._routeId),
      this._repository.getPointsByRouteId(this._routeId),
      this._photoRepo.getByRouteId(this._routeId),
    ]);
    this._points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    // Convert photos to PhotoWithUrl — in memory they don't have real URLs,
    // so we create placeholder URLs (the actual file data is stored separately)
    this.revokePhotoUrls();
    this._photos = photos.map((p) => ({
      ...p,
      objectUrl: p.filePath, // In MemoryPhotoRepository, filePath could be a data URL
    }));
    this.render(route, this._points);
  }

  private render(route: Route | null, points: { lat: number; lng: number }[]): void {
    const style = document.createElement('style');
    style.textContent = styles;

    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(style);

    if (!route) {
      root.appendChild(this.buildEmptyMessage());
      return;
    }

    const detail = document.createElement('div');
    detail.className = 'route-detail';
    detail.appendChild(this.buildBackButton());
    detail.appendChild(this.buildMap(points));
    detail.appendChild(this.buildContent(route));

    root.appendChild(detail);
  }

  private buildEmptyMessage(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'empty-msg';
    empty.textContent = 'Ruta no encontrada';
    return empty;
  }

  private buildBackButton(): HTMLElement {
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.innerHTML = '<span style="font-size:18px;">&larr;</span> Volver';
    backBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('back-to-list'));
    });
    return backBtn;
  }

  private buildMap(points: { lat: number; lng: number }[]): HTMLElement {
    const routeMap = document.createElement('route-map') as HTMLElement & {
      points: { lat: number; lng: number }[];
      photos?: Photo[];
    };
    routeMap.points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    routeMap.photos = this._photos;
    return routeMap;
  }

  private buildContent(route: Route): HTMLElement {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.appendChild(this.buildHeader(route));
    content.appendChild(this.buildStatGrid(route));
    content.appendChild(this.buildChart());
    content.appendChild(this.buildPhotosSection());
    return content;
  }

  private buildHeader(route: Route): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'detail-title';
    title.textContent = `Ruta ${route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}`;
    fragment.appendChild(title);

    const date = document.createElement('p');
    date.className = 'detail-date';
    date.textContent = route.createdAt ? new Date(route.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    fragment.appendChild(date);

    return fragment;
  }

  private buildStatGrid(route: Route): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'stat-grid cols-2';
    grid.innerHTML = `
      <div class="stat-tile"><span class="stat-label">Distancia</span><span class="stat-value">${route.totalDistance.toFixed(1)} <span class="stat-unit">km</span></span></div>
      <div class="stat-tile"><span class="stat-label">Duración</span><span class="stat-value">${formatDuration(route.duration)}</span></div>
      <div class="stat-tile"><span class="stat-label">Vel. media</span><span class="stat-value">${route.avgSpeed.toFixed(0)} <span class="stat-unit">km/h</span></span></div>
      <div class="stat-tile"><span class="stat-label">Desnivel</span><span class="stat-value">-- <span class="stat-unit">m</span></span></div>
    `;
    return grid;
  }

  private buildChart(): HTMLElement {
    const chart = document.createElement('div');
    chart.className = 'route-chart';
    chart.innerHTML = '<div class="chart-label">Velocidad durante la ruta</div><div class="chart-area">(próximamente)</div>';
    return chart;
  }

  private buildPhotosSection(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const photosLabel = document.createElement('div');
    photosLabel.className = 'section-label';
    photosLabel.textContent = 'Fotos de la ruta';
    fragment.appendChild(photosLabel);

    // Botón para añadir foto
    const photoCapture = document.createElement('photo-capture');
    photoCapture.setAttribute('data-cy', 'detail-photo-capture');
    photoCapture.setAttribute('style', 'margin-bottom: 12px;');
    photoCapture.addEventListener(PHOTO_CAPTURE_EVENT, ((event: CustomEvent<PhotoCaptureEventDetail>) => {
      void this.handleAddPhoto(event.detail.source);
    }) as EventListener);
    fragment.appendChild(photoCapture);

    // Galería de fotos con imágenes reales
    if (this._photos.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'photo-placeholder';
      placeholder.setAttribute('data-cy', 'photo-placeholder');
      placeholder.textContent = 'Sin fotos';
      fragment.appendChild(placeholder);
    } else {
      const gallery = document.createElement('div');
      gallery.className = 'photo-gallery';
      gallery.setAttribute('data-cy', 'photo-gallery');

      for (let i = 0; i < this._photos.length; i++) {
        const photo = this._photos[i]!;
        const thumb = document.createElement('div');
        thumb.className = 'photo-thumbnail';
        thumb.setAttribute('data-cy', 'photo-thumbnail');

        const img = document.createElement('img');
        img.src = photo.objectUrl;
        img.alt = `Foto ${i + 1}`;
        img.style.cssText = `
          width: 100%; height: 100%; object-fit: cover;
          border-radius: var(--r-sm, 8px);
        `;
        img.loading = 'lazy';
        img.addEventListener('click', () => { this.openViewer(i); });
        thumb.appendChild(img);

        gallery.appendChild(thumb);
      }

      fragment.appendChild(gallery);
    }

    return fragment;
  }

  private async handleAddPhoto(source: 'camera' | 'gallery'): Promise<void> {
    if (!this._routeId) return;

    const file = source === 'camera'
      ? await captureFromCamera()
      : await pickFromGallery();

    // Store the file as object URL before persisting
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const result = await addPhotoToRoute(file, this._routeId, this._photoRepo, this._points);

      if (result) {
        // Refresh photos with the new objectUrl
        this._photos = (await this._photoRepo.getByRouteId(this._routeId)).map((p) => ({
          ...p,
          objectUrl: p.filePath,
        }));
        // Override the last photo's URL with the actual blob URL
        if (this._photos.length > 0) {
          this._photos[this._photos.length - 1]!.objectUrl = objectUrl;
        }
        this.rerenderPhotosSection();
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  private rerenderPhotosSection(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const detail = root.querySelector('.detail-content');
    if (!detail) return;

    const labels = detail.querySelectorAll('.section-label');
    const lastLabel = labels[labels.length - 1];
    if (lastLabel) {
      let el: ChildNode | null = lastLabel.nextSibling;
      while (el) {
        const next = el.nextSibling;
        el.remove();
        el = next;
      }
      lastLabel.remove();
    }

    const newSection = this.buildPhotosSection();
    detail.appendChild(newSection);
  }

  private openViewer(index: number): void {
    const viewer = document.createElement('div');
    viewer.className = 'photo-viewer-overlay';
    viewer.setAttribute('data-cy', 'photo-viewer');
    viewer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.95); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-cy', 'photo-viewer-close');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute; top: 16px; right: 16px; z-index: 10;
      width: 56px; height: 56px; background: transparent; border: none;
      color: white; font-size: 28px; cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => { viewer.remove(); });

    const photo = this._photos[index];
    if (!photo) return;

    const img = document.createElement('img');
    img.src = photo.objectUrl;
    img.alt = `Foto ${index + 1}`;
    img.style.cssText = `
      max-width: 95%; max-height: 85%; object-fit: contain;
      border-radius: 4px;
    `;

    const counter = document.createElement('div');
    counter.style.cssText = `
      position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
      color: #888; font-size: 14px; font-family: var(--font-ui, Barlow, sans-serif);
    `;
    counter.textContent = `${index + 1} de ${this._photos.length}`;

    viewer.appendChild(closeBtn);
    viewer.appendChild(img);
    viewer.appendChild(counter);
    document.body.appendChild(viewer);
  }
}

customElements.define('route-detail', RouteDetail);