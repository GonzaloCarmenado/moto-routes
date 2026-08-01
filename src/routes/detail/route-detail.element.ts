import styles from './route-detail.element.css?inline';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Route, RoutePoint } from '../../shared/models/route.types.js';
import { formatDuration } from '../../shared/utils/format.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import '../../shared/route-map/route-map.element.js';
import { ROUTE_MAP_PHOTO_SELECT_EVENT, type RouteMapPhotoSelectDetail } from '../../shared/route-map/route-map.element.js';
import type { MapPhoto } from '../../shared/route-map/route-map-photos.js';
import '../../shared/photo-capture/photo-capture.element.js';
import type { PhotoCaptureElement } from '../../shared/photo-capture/photo-capture.element.js';
import { PHOTO_CAPTURE_EVENT, type PhotoCaptureEventDetail } from '../../shared/photo-capture/photo-capture.types.js';
import { applyPhotoCaptureLimit } from '../../shared/photo-capture/photo-capture.limit.js';
import { createPhotoRepository } from '../../shared/services/photo-storage.service.js';
import { captureFromCamera, pickFromGallery } from '../../shared/services/photo-capture-adapter.service.js';
import { addPhotoToRoute } from './route-detail-photo.service.js';
import { deletePhotoWithConfirmation } from '../../shared/services/photo-delete.service.js';
import { getPhotoUrl } from '../../shared/services/photo-storage.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { showToast } from '../../shared/feedback/toast.js';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import '../../shared/photo-gallery/photo-gallery.element.js';
import { PHOTO_GALLERY_SELECT_EVENT, type PhotoGallerySelectDetail, type GalleryPhoto, type PhotoGalleryLayout } from '../../shared/photo-gallery/photo-gallery.element.js';
import { openPhotoViewer } from '../../shared/photo-viewer/photo-viewer.element.js';
import '../../shared/tab-bar/tab-bar.element.js';
import type { PhotoWithUrl, TabBarElement } from './route-detail.types.js';
import { buildNotasPanel, saveRouteNote } from './route-detail-notes.js';
import { buildTimelinePanel } from './route-detail-timeline.js';
import type { TimelinePhotoInput } from './route-timeline.types.js';

class RouteDetail extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;
  private _route: Route | null = null;
  private _photoRepo: IPhotoRepository | null = null;
  private _photos: PhotoWithUrl[] = [];
  private _points: { lat: number; lng: number }[] = [];
  private _routePoints: RoutePoint[] = [];
  private _photoCaptureEl: PhotoCaptureElement | null = null;
  private _fotosPanelEl: HTMLElement | null = null;
  private _timelinePanelEl: HTMLElement | null = null;
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
    this._routePoints = points;
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
      photos?: MapPhoto[];
    };
    routeMap.points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    routeMap.photos = this._photos; // AC-016: objectUrl ya resuelto, igual que la galería
    // AC-015/AC-017: solo el marcador individual dispara este evento, nunca un cluster.
    routeMap.addEventListener(ROUTE_MAP_PHOTO_SELECT_EVENT, ((event: CustomEvent<RouteMapPhotoSelectDetail>) => {
      const index = this.toGalleryPhotos().findIndex((p) => p.id === event.detail.photo.id);
      if (index !== -1) this.openPhotoViewerAt(index);
    }) as EventListener);
    return routeMap;
  }

  private buildContent(route: Route): HTMLElement {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.appendChild(this.buildHeader(route));
    content.appendChild(this.buildStatGrid(route));
    content.appendChild(this.buildTabBar(route));
    return content;
  }

  /**
   * Envuelve "Fotos"/"Estadísticas"/"Notas"/"Timeline" en un `<tab-bar>` (AC-005, AC-006, AC-001).
   * Cada panel se añade como hijo ligero marcado con `slot="{id}"`, siguiendo
   * la API de `<tab-bar>` — nunca se reconstruye al cambiar de pestaña (AC-008).
   */
  private buildTabBar(route: Route): TabBarElement {
    const tabBar = document.createElement('tab-bar') as TabBarElement;
    tabBar.tabs = [
      { id: 'fotos', label: 'Fotos' },
      { id: 'estadisticas', label: 'Estadísticas' },
      { id: 'notas', label: 'Notas' },
      { id: 'timeline', label: 'Timeline' },
    ];

    this._fotosPanelEl = this.buildPhotosSection();
    tabBar.appendChild(this._fotosPanelEl);
    tabBar.appendChild(this.buildEstadisticasPanel());
    tabBar.appendChild(buildNotasPanel(route, (textarea) => this.handleSaveNote(route, textarea)));
    this._timelinePanelEl = this.buildTimelinePanel();
    tabBar.appendChild(this._timelinePanelEl);
    return tabBar;
  }

  private async handleSaveNote(route: Route, textarea: HTMLTextAreaElement): Promise<boolean> {
    if (!this._repository) return false;
    return saveRouteNote(this._repository, route, textarea);
  }

  /** "Estadísticas": placeholder de gráfica ya existente, sin cambios (AC-007). */
  private buildEstadisticasPanel(): HTMLElement {
    const chart = this.buildChart();
    chart.setAttribute('slot', 'estadisticas');
    return chart;
  }

  private buildHeader(route: Route): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'detail-title';
    title.setAttribute('data-cy', 'route-detail-title');
    title.textContent = buildRouteDisplayName(route.name, route.createdAt);
    fragment.appendChild(title);

    const date = document.createElement('p');
    date.className = 'detail-date';
    date.textContent = formatRouteDate(route.createdAt);
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
    applyPhotoCaptureLimit(photoCapture, this._photos.length);
    return photoCapture;
  }

  private toGalleryPhotos(): GalleryPhoto[] {
    return this._photos.map((p) => ({ id: p.id, objectUrl: p.objectUrl }));
  }

  private buildGalleryElement(): HTMLElement {
    const gallery = document.createElement('photo-gallery') as HTMLElement & { photos: GalleryPhoto[]; layout: PhotoGalleryLayout };
    gallery.layout = 'grid';
    gallery.photos = this.toGalleryPhotos();
    gallery.addEventListener(PHOTO_GALLERY_SELECT_EVENT, ((event: CustomEvent<PhotoGallerySelectDetail>) => {
      this.openPhotoViewerAt(event.detail.index);
    }) as EventListener);
    return gallery;
  }

  /** Único punto de apertura del visor: galería en cuadrícula y popup del mapa
   * comparten esta misma llamada (AC-011, AC-015). */
  private openPhotoViewerAt(index: number): void {
    openPhotoViewer({ photos: this.toGalleryPhotos(), startIndex: index, onDelete: (photo) => this.handleDeletePhoto(photo.id) });
  }

  /** Panel de la pestaña "Fotos" (AC-006). Un `<div slot="fotos">` — no un
   * `DocumentFragment`, que no puede llevar el atributo `slot`. */
  private buildPhotosSection(): HTMLElement {
    const section = document.createElement('div');
    section.setAttribute('slot', 'fotos');

    const photosLabel = document.createElement('div');
    photosLabel.className = 'section-label';
    photosLabel.textContent = 'Fotos de la ruta';
    section.appendChild(photosLabel);
    section.appendChild(this.buildAddPhotoButton());
    section.appendChild(this.buildGalleryElement());

    return section;
  }

  /** Persiste una foto y devuelve si se guardó de verdad (muestra su propio toast de error). */
  private async persistSinglePhoto(file: File, photoRepo: IPhotoRepository): Promise<boolean> {
    try {
      return Boolean(await addPhotoToRoute(file, this._routeId!, photoRepo, this._points));
    } catch (err) {
      showToast(`⚠️ ${toErrorMessage(err, 'Error al añadir la foto')}`, 'error');
      return false;
    }
  }

  private async handleAddPhoto(source: 'camera' | 'gallery'): Promise<void> {
    if (!this._routeId) return;

    // La galería permite seleccionar varias fotos — hay que persistirlas todas,
    // no solo la primera.
    const files = source === 'camera'
      ? await captureFromCamera().then((file) => (file ? [file] : []))
      : await pickFromGallery();

    if (files.length === 0) return;

    // Feedback de carga: guardar en appDataDir/leer de vuelta puede tardar un momento,
    // y sin indicador parece que la subida no ha hecho nada.
    if (this._photoCaptureEl) this._photoCaptureEl.loading = true;
    try {
      const photoRepo = await this.getPhotoRepo();
      let addedAny = false;
      for (const file of files) {
        if (await this.persistSinglePhoto(file, photoRepo)) addedAny = true;
      }

      if (addedAny) {
        // Refresh photos with proper URLs (handles Tauri convertFileSrc)
        this._photos = await Promise.all(
          (await photoRepo.getByRouteId(this._routeId)).map(async (p) => ({
            ...p,
            objectUrl: await getPhotoUrl(p.filePath),
          })),
        );
        this.refreshAllPanels();
      }
    } finally {
      if (this._photoCaptureEl) this._photoCaptureEl.loading = false;
    }
  }

  /**
   * Reemplaza el panel de "Fotos" (tras añadir/borrar una foto) usando la
   * referencia directa guardada en `buildTabBar()`, en vez de buscarlo por
   * posición dentro de `.detail-content` — esa heurística ya no encontraría
   * nada, el contenido vive ahora dentro del `<tab-bar>`.
   */
  private rerenderPhotosSection(): void {
    if (!this._fotosPanelEl) return;
    const newSection = this.buildPhotosSection();
    this._fotosPanelEl.replaceWith(newSection);
    this._fotosPanelEl = newSection;
  }

  /** Construye el panel de Timeline. */
  private buildTimelinePanel(): HTMLElement {
    const timelinePhotos: TimelinePhotoInput[] = this._photos.map((p) => ({
      id: p.id,
      capturedAt: p.capturedAt,
    }));
    const el = buildTimelinePanel(
      this._routePoints,
      timelinePhotos,
      (photoId: string): void => {
        const idx = this.toGalleryPhotos().findIndex((gp) => gp.id === photoId);
        if (idx !== -1) this.openPhotoViewerAt(idx);
      },
    );
    return el;
  }

  /** Reconstruye el panel de Timeline tras cambios en las fotos. */
  private rerenderTimelinePanel(): void {
    if (!this._timelinePanelEl) return;
    const newPanel = this.buildTimelinePanel();
    this._timelinePanelEl.replaceWith(newPanel);
    this._timelinePanelEl = newPanel;
  }

  /** Refresca ambos paneles (Fotos y Timeline) al cambiar fotos. */
  private refreshAllPanels(): void {
    this.rerenderPhotosSection();
    this.rerenderTimelinePanel();
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
    this.refreshAllPanels();
    showToast('Foto eliminada', 'success');
    return true;
  }
}

customElements.define('route-detail', RouteDetail);