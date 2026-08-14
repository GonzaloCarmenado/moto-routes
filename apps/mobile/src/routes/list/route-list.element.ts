import styles from './route-list.element.css?inline';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { IPhotoRepository } from '../../shared/models/photo.repository.js';
import type { ISessionRepository } from '../../shared/models/session.repository.js';
import type { Session } from '../../shared/models/session.types.js';
import type { Route } from '../../shared/models/route.types.js';
import { getApiBaseUrl } from '../../shared/http/api-config.js';
import { formatDuration } from '../../shared/utils/format.js';
import { formatRouteDate } from '../../shared/utils/date.js';
import { buildRouteDisplayName } from '../../shared/utils/route-naming.js';
import { BaseElement } from '../../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';
import { createPhotoRepository } from '../../shared/services/photo-storage.service.js';
import { deleteRouteAndPhotos } from '../../shared/services/route-deletion.service.js';
import { confirmDialog } from '../../shared/feedback/confirm-dialog.element.js';
import { showToast } from '../../shared/feedback/toast.js';
import { toErrorMessage } from '../../shared/utils/errors.js';
import { buildPolylineSvgPath } from './route-list.transform.js';
import { ensurePreviewPolyline } from './route-list-polyline.service.js';
import { loadRouteListItems } from './route-list-sync.service.js';
import type { RouteListItem, RouteSyncState } from './route-list-sync.transform.js';
import { DEVICE_ICON, CLOUD_CHECK_ICON, CLOUD_ONLY_ICON } from '../../shared/icons/cloud-sync-icons.js';
import { TRASH_ICON } from '../../shared/icons/action-icons.js';
import { buildRouteCardFavoriteIcon, buildFavoritesFilterToggle } from './route-list-favorite.js';
import { buildSharingButton, hasPendingReceivedInvitations } from './route-list-sharing.js';

const THUMB_TRACE_SIZE = 72;

const SYNC_ICON_BY_STATE: Record<RouteSyncState, string> = {
  local: DEVICE_ICON,
  synced: CLOUD_CHECK_ICON,
  'cloud-only': CLOUD_ONLY_ICON,
};

const SYNC_LABEL_BY_STATE: Record<RouteSyncState, string> = {
  local: 'Solo en este dispositivo',
  synced: 'Sincronizada con la nube',
  'cloud-only': 'Solo en la nube',
};

class RouteList extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _sessionRepository: ISessionRepository | null = null;
  private _items: RouteListItem[] = [];
  private _hasSession = false;
  private _session: Session | null = null;
  private _loading = false;
  private _showFavoritesOnly = false;
  private _hasPendingShares = false;
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

  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
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

  /**
   * `fetchAndRender` puede dispararse varias veces solapadas (el setter de
   * `repository` y `connectedCallback` ya lo hacían los dos al arrancar la
   * app, antes de que exista sesión; `onNavRutas` añade una más después del
   * login) — sin guardarlas, la más lenta puede resolver la última y
   * sobrescribir con datos obsoletos (p. ej. "sin invitaciones pendientes")
   * el resultado ya correcto de una llamada posterior más rápida. Bug real
   * encontrado en Cypress (condición de carrera, no solo lentitud del test).
   */
  private _fetchToken = 0;

  private async fetchAndRender(): Promise<void> {
    if (!this._repository) return;
    const token = ++this._fetchToken;
    this._loading = true;
    this.render();
    this._session = (await this._sessionRepository?.get()) ?? null;
    const [result, hasPendingShares] = await Promise.all([
      loadRouteListItems(getApiBaseUrl(), this._repository, this._sessionRepository),
      hasPendingReceivedInvitations(getApiBaseUrl(), this._session),
    ]);
    if (token !== this._fetchToken) return;
    this._items = result.items;
    this._hasSession = result.hasSession;
    this._hasPendingShares = hasPendingShares;
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
      screen.appendChild(this.buildHeader(this._items));
      screen.appendChild(this.buildBody(this._items));
    }

    this.renderShadow(styles, screen);
  }

  private buildHeader(items: RouteListItem[]): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'route-list__title';
    title.textContent = 'Tus rutas';
    fragment.appendChild(title);

    const totalKm = items.reduce((sum, i) => sum + i.route.totalDistance, 0);
    const subtitle = document.createElement('p');
    subtitle.className = 'route-list__subtitle';
    subtitle.textContent = `${String(items.length)} rutas guardadas · ${totalKm.toFixed(1)} km recorridos`;
    fragment.appendChild(subtitle);

    if (this._hasSession) {
      fragment.appendChild(buildSharingButton(this._hasPendingShares));
    }

    if (items.length > 0) {
      fragment.appendChild(buildFavoritesFilterToggle(this._showFavoritesOnly, () => {
        this._showFavoritesOnly = !this._showFavoritesOnly;
        this.render();
      }));
    }

    return fragment;
  }

  private buildBody(items: RouteListItem[]): HTMLElement {
    const visible = this._showFavoritesOnly ? items.filter((i) => i.route.isFavorite) : items;

    if (visible.length === 0) {
      return this._showFavoritesOnly ? this.buildEmptyFavoritesState() : this.buildEmptyState();
    }

    const list = document.createElement('div');
    list.className = 'route-list__cards';
    for (const item of visible) {
      list.appendChild(this.buildCard(item));
    }
    return list;
  }

  private buildEmptyState(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'route-list__empty';
    empty.setAttribute('data-cy', 'route-list-empty');
    empty.textContent = 'No hay rutas guardadas todavía';
    return empty;
  }

  private buildEmptyFavoritesState(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'route-list__empty';
    empty.setAttribute('data-cy', 'route-list-empty-favoritas');
    empty.textContent = 'No tienes rutas favoritas todavía';
    return empty;
  }

  private buildCard(item: RouteListItem): HTMLElement {
    const { route } = item;
    const card = document.createElement('div');
    card.className = 'route-card';
    card.setAttribute('data-cy', 'route-card');
    card.dataset.routeId = route.id;
    card.addEventListener('click', () => {
      dispatchAppEvent(APP_EVENTS.VIEW_ROUTE, { routeId: route.id });
    });

    card.appendChild(this.buildThumbWithBadge(item, card));
    card.appendChild(this.buildInfo(item));
    if (this._repository) {
      card.appendChild(buildRouteCardFavoriteIcon({
        repository: this._repository,
        session: this._session,
        item,
        onToggled: () => { this.render(); },
      }));
    }
    const deleteBtn = this.buildDeleteButton(item);
    if (deleteBtn) card.appendChild(deleteBtn);
    return card;
  }

  /**
   * Envuelve la miniatura en un contenedor relativo con el icono de estado
   * de sincronización superpuesto en su esquina (solo con sesión activa —
   * sin sesión no hay ningún concepto de nube, AC de la spec
   * `route-cloud-sync`) — mismo patrón que el badge de "sincronizado" de
   * apps como Google Fotos, en vez de una columna de acciones aparte.
   */
  private buildThumbWithBadge(item: RouteListItem, card: HTMLElement): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumb-wrapper';
    wrapper.appendChild(this.buildThumb(item, card));
    if (this._hasSession) wrapper.appendChild(this.buildSyncIcon(item.syncState));
    return wrapper;
  }

  private buildInfo(item: RouteListItem): HTMLElement {
    const { route } = item;
    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = buildRouteDisplayName(route.name, route.createdAt);
    info.appendChild(name);

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = formatRouteDate(route.createdAt);
    info.appendChild(date);

    info.appendChild(this.buildBadges(route));
    return info;
  }

  private buildBadges(route: Route): HTMLElement {
    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.innerHTML = `<span class="badge distance">${route.totalDistance.toFixed(1)} km</span><span class="badge duration">${formatDuration(route.duration)}</span>`;
    return badges;
  }

  /** Icono de estado de sincronización, sin texto (ver design.md Decisión 9). */
  private buildSyncIcon(syncState: RouteSyncState): HTMLElement {
    const icon = document.createElement('span');
    icon.className = `sync-status-icon sync-status-icon--${syncState}`;
    icon.setAttribute('data-cy', 'route-card-sync-badge');
    icon.setAttribute('aria-label', SYNC_LABEL_BY_STATE[syncState]);
    icon.dataset.syncState = syncState;
    icon.innerHTML = SYNC_ICON_BY_STATE[syncState];
    return icon;
  }

  /**
   * Construye el `.thumb` de la tarjeta: la silueta SVG si `route` ya tiene
   * `previewPolyline` disponible, o el placeholder de franjas existente. En
   * este último caso, si la ruta aún no tiene el trazado calculado (`null`),
   * dispara el backfill perezoso en segundo plano (sin bloquear el render).
   */
  private buildThumb(item: RouteListItem, card: HTMLElement): HTMLElement {
    const { route, syncState } = item;
    const svgPath = buildPolylineSvgPath(route.previewPolyline, THUMB_TRACE_SIZE, THUMB_TRACE_SIZE);
    if (svgPath) return this.buildTraceThumb(svgPath);

    // Una ruta exclusiva de la nube no tiene puntos locales de los que
    // calcular el trazado — el backfill solo tiene sentido para rutas con
    // datos en el repositorio local.
    if (route.previewPolyline === null && syncState !== 'cloud-only') {
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
   * `null` para una ruta exclusiva de la nube: no hay requisito de negocio
   * para borrarla desde la app (ver design.md, Non-Goals) y, además, no
   * existe fila local que `IRouteRepository.delete()` pudiera afectar.
   */
  private buildDeleteButton(item: RouteListItem): HTMLButtonElement | null {
    if (item.syncState === 'cloud-only') return null;

    const { route } = item;
    const btn = document.createElement('button');
    btn.className = 'route-card__delete';
    btn.setAttribute('data-cy', 'route-card-btn-eliminar');
    btn.setAttribute('aria-label', 'Eliminar ruta');
    btn.innerHTML = TRASH_ICON;
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
      showToast(toErrorMessage(err, 'Error al eliminar la ruta'), 'error');
      return;
    }
    this._items = this._items.filter((i) => i.route.id !== route.id);
    this.render();
    showToast('Ruta eliminada', 'success');
  }
}

customElements.define('route-list', RouteList);