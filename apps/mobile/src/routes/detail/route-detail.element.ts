import styles from './route-detail.element.css?inline';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { Photo } from '../../shared/models/photo.types.js';
import type { ISessionRepository } from '../../shared/models/session.repository.js';
import type { Session } from '../../shared/models/session.types.js';
import type { Route, RoutePoint, RouteStop } from '../../shared/models/route.types.js';
import type { IStopTypesCacheRepository } from '../../shared/models/stop-types-cache.repository.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { loadCloudRouteDetail, checkIfRouteIsSynced } from './route-detail-cloud.service.js';
import { triggerAutoResync, triggerPhotoUpload, triggerPhotoDelete, type SyncTriggerContext } from './route-detail-sync-triggers.js';
import { buildSyncIconButton } from './route-detail-cloud-upload.js';
import { buildLoadingState, buildEmptyMessage, buildLoadErrorMessage } from './route-detail-states.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';
import { formatDuration } from '../../shared/utils/format.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import '../../shared/route-map/route-map.element.js';
import { ROUTE_MAP_PHOTO_SELECT_EVENT, type RouteMapPhotoSelectDetail } from '../../shared/route-map/route-map.element.js';
import type { MapPhoto } from '../../shared/route-map/route-map-photos.js';
import type { MapStop } from '../../shared/route-map/route-map-stops.js';
import '../../shared/photo-capture/photo-capture.element.js';
import type { PhotoCaptureElement } from '../../shared/photo-capture/photo-capture.element.js';
import { createPhotoRepository } from '../../shared/services/photo-storage.service.js';
import { captureFromCamera, pickFromGallery } from '../../shared/services/photo-capture-adapter.service.js';
import { addPhotoToRoute, syncPhotoRemoteState } from './route-detail-photo.service.js';
import { deletePhotoWithConfirmation } from '../../shared/services/photo-delete.service.js';
import { getPhotoUrl } from '../../shared/services/photo-storage.service.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { showToast } from '../../shared/feedback/toast.js';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import { buildPhotosSection, toGalleryPhotos } from './route-detail-photos-panel.js';
import { openPhotoViewer } from '../../shared/photo-viewer/photo-viewer.element.js';
import '../../shared/tab-bar/tab-bar.element.js';
import type { PhotoWithUrl, TabBarElement } from './route-detail.types.js';
import { buildNotasPanel, saveRouteNote } from './route-detail-notes.js';
import { buildTimelinePanel } from './route-detail-timeline.js';
import type { TimelinePhotoInput, TimelineStopInput } from './route-timeline.types.js';

class RouteDetail extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _routeId: string | null = null;
  private _route: Route | null = null;
  private _photoRepo: IPhotoRepository | null = null;
  private _photos: PhotoWithUrl[] = [];
  private _points: { lat: number; lng: number }[] = [];
  private _routePoints: RoutePoint[] = [];
  private _routeStops: RouteStop[] = [];
  private _stopTypesCache: IStopTypesCacheRepository | null = null;
  private _categoriesById = new Map<number, StopCategory>();
  private _photoCaptureEl: PhotoCaptureElement | null = null;
  private _fotosPanelEl: HTMLElement | null = null;
  private _timelinePanelEl: HTMLElement | null = null;
  private _loading = false;
  private _sessionRepository: ISessionRepository | null = null;
  private _session: Session | null = null;
  /** `false` cuando `_route` se cargó de la nube — sin datos locales de los
   * que subir nada, así que la acción "Subir a la nube" no tiene sentido
   * para esa ruta. */
  private _isLocalRoute = true;
  /** Si la ruta local actual ya existe también en la nube (ver
   * `checkIfRouteIsSynced`) — decide el icono del detalle y si un cambio
   * local (nota/foto) dispara una re-subida automática. */
  private _isSynced = false;
  /** Mensaje a mostrar si la ruta no existe localmente y falla la consulta a
   * la nube (p. ej. sin conexión) — `null` mientras no haya ningún fallo. */
  private _loadError: string | null = null;

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

  set stopTypesCacheRepository(repo: IStopTypesCacheRepository | null) {
    this._stopTypesCache = repo;
  }

  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
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
    this._loadError = null;
    this.render();

    this._session = (await this._sessionRepository?.get()) ?? null;
    const categories = await (this._stopTypesCache?.getAll() ?? Promise.resolve([]));
    this._categoriesById = new Map(categories.map((c) => [c.id, c]));

    const localRoute = await this._repository.getById(this._routeId);
    if (localRoute) {
      await this.loadLocalRouteData(localRoute);
    } else if (this._session) {
      // Sin datos locales, pero con sesión: puede ser una ruta exclusiva de
      // la nube (ver spec route-cloud-sync) — se descarga bajo demanda.
      await this.loadCloudRouteData(this._routeId, this._session);
    } else {
      this._isLocalRoute = true;
      this._isSynced = false;
      this._route = null;
    }

    this._loading = false;
    this.render();
  }

  private async loadLocalRouteData(route: Route): Promise<void> {
    if (!this._repository || !this._routeId) return;
    const photoRepo = await this.getPhotoRepo();
    const [points, stops, photos, isSynced] = await Promise.all([
      this._repository.getPointsByRouteId(this._routeId),
      this._repository.getStopsByRouteId(this._routeId),
      photoRepo.getByRouteId(this._routeId),
      this._session ? checkIfRouteIsSynced(getApiBaseUrl(), this._session, this._routeId) : Promise.resolve(false),
    ]);
    this._isLocalRoute = true;
    this._isSynced = isSynced;
    this._route = route;
    this._routePoints = points;
    this._points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    this._routeStops = stops;
    this.revokePhotoUrls();
    // Convert file paths to accessible URLs (handles Tauri convertFileSrc)
    this._photos = await Promise.all(photos.map(async (p) => ({
      ...p,
      objectUrl: await getPhotoUrl(p.filePath),
    })));
  }

  /**
   * Ruta exclusiva de la nube (no existe en `IRouteRepository`): sin fotos
   * (fuera de alcance, ver design.md) — un fallo de red se convierte en
   * `_loadError`, nunca deja la pantalla en blanco ni sin explicación.
   */
  private async loadCloudRouteData(routeId: string, session: Session): Promise<void> {
    this._isLocalRoute = false;
    this._isSynced = false;
    this.revokePhotoUrls();
    this._photos = [];

    const result = await loadCloudRouteDetail(getApiBaseUrl(), session, routeId);
    if (result.error !== undefined) {
      this._route = null;
      this._loadError = result.error;
      return;
    }
    this._route = result.route;
    this._routePoints = result.points;
    this._points = result.points.map((p) => ({ lat: p.lat, lng: p.lng }));
    this._routeStops = result.stops;
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    if (this._loading) {
      this.renderShadow(styles, buildLoadingState());
      return;
    }

    if (!this._route) {
      this.renderShadow(styles, this._loadError ? buildLoadErrorMessage(this._loadError) : buildEmptyMessage());
      return;
    }

    const detail = document.createElement('div');
    detail.className = 'route-detail';
    detail.appendChild(this.buildBackButton());
    detail.appendChild(this.buildMap(this._points));
    detail.appendChild(this.buildContent(this._route));

    this.renderShadow(styles, detail);
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
      stops?: MapStop[];
      stopCategoriesById?: Map<number, StopCategory>;
    };
    routeMap.points = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    routeMap.photos = this._photos; // AC-016: objectUrl ya resuelto, igual que la galería
    // AC-7.1 a AC-7.3: mismos datos ya resueltos para la timeline (Grupo 6), reutilizados aquí.
    routeMap.stops = this._routeStops.map((s) => ({ lat: s.lat, lng: s.lng, stopCategoryId: s.stopCategoryId }));
    routeMap.stopCategoriesById = this._categoriesById;
    // AC-015/AC-017: solo el marcador individual dispara este evento, nunca un cluster.
    routeMap.addEventListener(ROUTE_MAP_PHOTO_SELECT_EVENT, ((event: CustomEvent<RouteMapPhotoSelectDetail>) => {
      const index = toGalleryPhotos(this._photos).findIndex((p) => p.id === event.detail.photo.id);
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
   * "Subir a la nube" / "Ya sincronizada": solo con sesión activa y ruta de
   * origen local (AC de la spec `route-cloud-sync`) — sin sesión, o para una
   * ruta ya cargada desde la nube, la acción no tiene sentido y no se muestra.
   */
  private buildSyncIcon(route: Route): HTMLButtonElement | null {
    if (!this._session || !this._isLocalRoute || !this._repository) return null;
    return buildSyncIconButton({
      apiBaseUrl: getApiBaseUrl(),
      session: this._session,
      repository: this._repository,
      route,
      isSynced: this._isSynced,
      onUploaded: () => {
        this._isSynced = true;
        this.render();
      },
    });
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
    const saved = await saveRouteNote(this._repository, route, textarea);
    if (saved) triggerAutoResync(this.syncContext(), route);
    return saved;
  }

  /** Contexto común a los triggers de sincronización en segundo plano (ver `route-detail-sync-triggers.ts`). */
  private syncContext(): SyncTriggerContext {
    return { session: this._session, routeId: this._routeId, repository: this._repository, isSynced: this._isSynced };
  }

  /** "Estadísticas": placeholder de gráfica ya existente, sin cambios (AC-007). */
  private buildEstadisticasPanel(): HTMLElement {
    const chart = this.buildChart();
    chart.setAttribute('slot', 'estadisticas');
    return chart;
  }

  private buildHeader(route: Route): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const titleRow = document.createElement('div');
    titleRow.className = 'detail-title-row';

    const title = document.createElement('h1');
    title.className = 'detail-title';
    title.setAttribute('data-cy', 'route-detail-title');
    title.textContent = buildRouteDisplayName(route.name, route.createdAt);
    titleRow.appendChild(title);

    const syncIcon = this.buildSyncIcon(route);
    if (syncIcon) titleRow.appendChild(syncIcon);

    fragment.appendChild(titleRow);

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

  /** Único punto de apertura del visor: galería en cuadrícula y popup del mapa
   * comparten esta misma llamada (AC-011, AC-015). */
  private openPhotoViewerAt(index: number): void {
    openPhotoViewer({ photos: toGalleryPhotos(this._photos), startIndex: index, onDelete: (photo) => this.handleDeletePhoto(photo.id) });
  }

  private buildPhotosSection(): HTMLElement {
    return buildPhotosSection(
      this._photos,
      {
        onAddPhoto: (source) => { void this.handleAddPhoto(source); },
        onSelectPhoto: (index) => { this.openPhotoViewerAt(index); },
      },
      (el) => { this._photoCaptureEl = el; },
    );
  }

  /** Persiste una foto y devuelve la entidad creada, o `null` si falló (muestra su propio toast de error). */
  private async persistSinglePhoto(file: File, photoRepo: IPhotoRepository): Promise<Photo | null> {
    try {
      const result = await addPhotoToRoute(file, this._routeId!, photoRepo, this._points);
      return result?.photo ?? null;
    } catch (err) {
      showToast(toErrorMessage(err, 'Error al añadir la foto'), 'error');
      return null;
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
      const addedPhotos: Photo[] = [];
      for (const file of files) {
        const photo = await this.persistSinglePhoto(file, photoRepo);
        if (photo) addedPhotos.push(photo);
      }

      if (addedPhotos.length > 0) {
        // Refresh photos with proper URLs (handles Tauri convertFileSrc)
        this._photos = await Promise.all(
          (await photoRepo.getByRouteId(this._routeId)).map(async (p) => ({
            ...p,
            objectUrl: await getPhotoUrl(p.filePath),
          })),
        );
        this.refreshAllPanels();
        // Re-sube metadatos/puntos/paradas y, además, cada foto en sí (subida
        // secuencial, no en paralelo — ver design.md Decisión 6).
        if (this._route) triggerAutoResync(this.syncContext(), this._route);
        for (const photo of addedPhotos) {
          void triggerPhotoUpload(this.syncContext(), photoRepo, photo)
            .then(async () => { this._photos = await syncPhotoRemoteState(this._photos, photoRepo, photo.id); });
        }
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
    const timelineStops: TimelineStopInput[] = this._routeStops.map((s) => ({
      startTime: s.startTime,
      lat: s.lat,
      lng: s.lng,
      stopCategoryId: s.stopCategoryId,
    }));
    const el = buildTimelinePanel(
      { points: this._routePoints, photos: timelinePhotos, stops: timelineStops, categoriesById: this._categoriesById },
      (photoId: string): void => {
        const idx = toGalleryPhotos(this._photos).findIndex((gp) => gp.id === photoId);
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
      showToast(toErrorMessage(err, 'Error al eliminar la foto'), 'error');
      return false;
    }

    URL.revokeObjectURL(photo.objectUrl);
    this._photos = this._photos.filter((p) => p.id !== photoId);
    this.refreshAllPanels();
    showToast('Foto eliminada', 'success');
    if (this._route) triggerAutoResync(this.syncContext(), this._route);
    // El remotePhotoId se captura del objeto `photo` ya cargado, antes de que
    // deletePhotoWithConfirmation() borre la fila local — una vez borrada ya
    // no sería recuperable (ver design.md Decisión 5).
    triggerPhotoDelete(this.syncContext(), photo.remotePhotoId);
    return true;
  }
}

customElements.define('route-detail', RouteDetail);