import styles from './route-detail.element.css?inline';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IPhotoRepository } from '../shared/models/photo.repository.js';
import type { Photo } from '../shared/models/photo.types.js';
import type { Route } from '../shared/models/route.types.js';
import { formatDuration } from '../cockpit/cockpit.transform.js';
import '../shared/route-map/route-map.element.js';
import '../photos/photo-capture.element.js';
import type { PhotoCaptureElement } from '../photos/photo-capture.element.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../photos/photo-capture.types.js';
import { createPhotoRepository } from '../shared/services/photo-storage.service.js';
import { captureFromCamera, pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import { addPhotoToRoute } from './route-detail-photo.service.js';
import { getPhotoUrl } from '../shared/services/photo-storage.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/utils/toast.js';

/**
 * Tipo que asocia una foto con su URL de objeto para mostrar en UI.
 */
interface PhotoWithUrl extends Photo {
  objectUrl: string;
}

class RouteDetail extends HTMLElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;
  private _photoRepo: IPhotoRepository | null = null;
  private _photos: PhotoWithUrl[] = [];
  private _points: { lat: number; lng: number }[] = [];
  private _photoCaptureEl: PhotoCaptureElement | null = null;

  private async getPhotoRepo(): Promise<IPhotoRepository> {
    this._photoRepo ??= await createPhotoRepository();
    return this._photoRepo;
  }

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
    const photoRepo = await this.getPhotoRepo();
    const [route, points, photos] = await Promise.all([
      this._repository.getById(this._routeId),
      this._repository.getPointsByRouteId(this._routeId),
      photoRepo.getByRouteId(this._routeId),
    ]);
    this._points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    this.revokePhotoUrls();
    // Convert file paths to accessible URLs (handles Tauri convertFileSrc)
    this._photos = await Promise.all(photos.map(async (p) => ({
      ...p,
      objectUrl: await getPhotoUrl(p.filePath),
    })));
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

  private buildAddPhotoButton(): PhotoCaptureElement {
    const photoCapture = document.createElement('photo-capture') as PhotoCaptureElement;
    photoCapture.setAttribute('data-cy', 'detail-photo-capture');
    photoCapture.setAttribute('style', 'margin-bottom: 12px;');
    photoCapture.addEventListener(PHOTO_CAPTURE_EVENT, ((event: CustomEvent<PhotoCaptureEventDetail>) => {
      void this.handleAddPhoto(event.detail.source);
    }) as EventListener);
    this._photoCaptureEl = photoCapture;
    return photoCapture;
  }

  private buildPhotoPlaceholder(): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'photo-placeholder';
    placeholder.setAttribute('data-cy', 'photo-placeholder');
    placeholder.textContent = 'Sin fotos';
    return placeholder;
  }

  private buildPhotoThumbnail(photo: PhotoWithUrl, index: number): HTMLElement {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumbnail';
    thumb.setAttribute('data-cy', 'photo-thumbnail');

    const img = document.createElement('img');
    img.src = photo.objectUrl;
    img.alt = `Foto ${String(index + 1)}`;
    img.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      border-radius: var(--r-sm, 8px);
      cursor: pointer;
    `;
    img.loading = 'lazy';
    img.addEventListener('click', () => { this.openViewer(index); });
    // Also handle click on the container for fallback
    thumb.addEventListener('click', () => { this.openViewer(index); });
    thumb.appendChild(img);

    return thumb;
  }

  private buildPhotoGallery(): HTMLElement {
    const gallery = document.createElement('div');
    gallery.className = 'photo-gallery';
    gallery.setAttribute('data-cy', 'photo-gallery');
    for (let i = 0; i < this._photos.length; i++) {
      gallery.appendChild(this.buildPhotoThumbnail(this._photos[i]!, i));
    }
    return gallery;
  }

  private buildPhotosSection(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const photosLabel = document.createElement('div');
    photosLabel.className = 'section-label';
    photosLabel.textContent = 'Fotos de la ruta';
    fragment.appendChild(photosLabel);
    fragment.appendChild(this.buildAddPhotoButton());

    fragment.appendChild(
      this._photos.length === 0 ? this.buildPhotoPlaceholder() : this.buildPhotoGallery(),
    );

    return fragment;
  }

  private async handleAddPhoto(source: 'camera' | 'gallery'): Promise<void> {
    if (!this._routeId) return;

    const file = source === 'camera'
      ? await captureFromCamera()
      : await pickFromGallery();

    if (!file) return;

    // Feedback de carga: guardar en appDataDir/leer de vuelta puede tardar un momento,
    // y sin indicador parece que la subida no ha hecho nada.
    if (this._photoCaptureEl) this._photoCaptureEl.loading = true;
    try {
      const photoRepo = await this.getPhotoRepo();
      const result = await addPhotoToRoute(file, this._routeId, photoRepo, this._points);

      if (result) {
        // Refresh photos with proper URLs (handles Tauri convertFileSrc)
        this._photos = await Promise.all(
          (await photoRepo.getByRouteId(this._routeId)).map(async (p) => ({
            ...p,
            objectUrl: await getPhotoUrl(p.filePath),
          })),
        );
        this.rerenderPhotosSection();
      }
    } catch (err) {
      showToast(`⚠️ ${toErrorMessage(err, 'Error al añadir la foto')}`, 'error');
    } finally {
      if (this._photoCaptureEl) this._photoCaptureEl.loading = false;
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
    img.alt = `Foto ${String(index + 1)}`;
    img.style.cssText = `
      max-width: 95%; max-height: 85%; object-fit: contain;
      border-radius: 4px;
    `;

    const counter = document.createElement('div');
    counter.style.cssText = `
      position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
      color: #888; font-size: 14px; font-family: var(--font-ui, Barlow, sans-serif);
    `;
    counter.textContent = `${String(index + 1)} de ${String(this._photos.length)}`;

    viewer.appendChild(closeBtn);
    viewer.appendChild(img);
    viewer.appendChild(counter);
    document.body.appendChild(viewer);
  }
}

customElements.define('route-detail', RouteDetail);