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
import { addPhotoToRoute, deletePhotoWithConfirmation } from './route-detail-photo.service.js';
import { getPhotoUrl } from '../shared/services/photo-storage.service.js';
import { toErrorMessage } from '../shared/utils/errors.js';
import { showToast } from '../shared/feedback/toast.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import '../shared/photo-gallery/photo-gallery.element.js';
import { PHOTO_GALLERY_SELECT_EVENT, type PhotoGallerySelectDetail, type GalleryPhoto } from '../shared/photo-gallery/photo-gallery.element.js';
import { openPhotoViewer } from '../shared/photo-viewer/photo-viewer.element.js';

/**
 * Tipo que asocia una foto con su URL de objeto para mostrar en UI.
 */
interface PhotoWithUrl extends Photo {
  objectUrl: string;
}

class RouteDetail extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;
  private _route: Route | null = null;
  private _photoRepo: IPhotoRepository | null = null;
  private _photos: PhotoWithUrl[] = [];
  private _points: { lat: number; lng: number }[] = [];
  private _photoCaptureEl: PhotoCaptureElement | null = null;
  private _loading = false;

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
    this._loading = true;
    this.render();

    const photoRepo = await this.getPhotoRepo();
    const [route, points, photos] = await Promise.all([
      this._repository.getById(this._routeId),
      this._repository.getPointsByRouteId(this._routeId),
      photoRepo.getByRouteId(this._routeId),
    ]);
    this._route = route;
    this._points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    this.revokePhotoUrls();
    // Convert file paths to accessible URLs (handles Tauri convertFileSrc)
    this._photos = await Promise.all(photos.map(async (p) => ({
      ...p,
      objectUrl: await getPhotoUrl(p.filePath),
    })));
    this._loading = false;
    this.render();
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    if (this._loading) {
      this.renderShadow(styles, this.buildLoadingState());
      return;
    }

    if (!this._route) {
      this.renderShadow(styles, this.buildEmptyMessage());
      return;
    }

    const detail = document.createElement('div');
    detail.className = 'route-detail';
    detail.appendChild(this.buildBackButton());
    detail.appendChild(this.buildMap(this._points));
    detail.appendChild(this.buildContent(this._route));

    this.renderShadow(styles, detail);
  }

  private buildLoadingState(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'empty-msg';
    el.setAttribute('data-cy', 'route-detail-loading');
    el.textContent = 'Cargando ruta…';
    return el;
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
    backBtn.innerHTML = '<span class="back-btn__arrow">&larr;</span> Volver';
    backBtn.addEventListener('click', () => {
      dispatchAppEvent(APP_EVENTS.BACK_TO_LIST);
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
    photoCapture.classList.add('detail-photo-capture');
    photoCapture.addEventListener(PHOTO_CAPTURE_EVENT, ((event: CustomEvent<PhotoCaptureEventDetail>) => {
      void this.handleAddPhoto(event.detail.source);
    }) as EventListener);
    this._photoCaptureEl = photoCapture;
    return photoCapture;
  }

  private toGalleryPhotos(): GalleryPhoto[] {
    return this._photos.map((p) => ({ id: p.id, objectUrl: p.objectUrl }));
  }

  private buildGalleryElement(): HTMLElement {
    const gallery = document.createElement('photo-gallery') as HTMLElement & { photos: GalleryPhoto[] };
    gallery.photos = this.toGalleryPhotos();
    gallery.addEventListener(PHOTO_GALLERY_SELECT_EVENT, ((event: CustomEvent<PhotoGallerySelectDetail>) => {
      openPhotoViewer({
        photos: this.toGalleryPhotos(),
        startIndex: event.detail.index,
        onDelete: (photo) => this.handleDeletePhoto(photo.id),
      });
    }) as EventListener);
    return gallery;
  }

  private buildPhotosSection(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const photosLabel = document.createElement('div');
    photosLabel.className = 'section-label';
    photosLabel.textContent = 'Fotos de la ruta';
    fragment.appendChild(photosLabel);
    fragment.appendChild(this.buildAddPhotoButton());
    fragment.appendChild(this.buildGalleryElement());

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

  /** Devuelve si se borró de verdad, para que `<photo-viewer>` sepa si debe quitarla de su vista. */
  private async handleDeletePhoto(photoId: string): Promise<boolean> {
    const photo = this._photos.find((p) => p.id === photoId);
    if (!photo) return false;

    try {
      const photoRepo = await this.getPhotoRepo();
      if (await deletePhotoWithConfirmation(photo, photoRepo) === 'cancelled') return false;
    } catch (err) {
      showToast(`⚠️ ${toErrorMessage(err, 'Error al eliminar la foto')}`, 'error');
      return false;
    }

    URL.revokeObjectURL(photo.objectUrl);
    this._photos = this._photos.filter((p) => p.id !== photoId);
    this.rerenderPhotosSection();
    showToast('Foto eliminada', 'success');
    return true;
  }
}

customElements.define('route-detail', RouteDetail);