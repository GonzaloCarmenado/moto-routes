/**
 * Web Component `<profile-view>`: pantalla "Perfil", que compone las tres
 * secciones de la spec (avatar+nombre, "Mi vehículo", estadísticas
 * agregadas), inyectada con `IProfileRepository` (perfil/vehículo) e
 * `IRouteRepository` (estadísticas), montada como hermano persistente de
 * `cockpit-view`/`route-list`/`route-detail` en `app.element.ts` (Paso 14).
 *
 * Sigue el mismo patrón de setters `repository`/`fetchAndRender()` que
 * `route-list.element.ts`: la carga inicial ocurre en `fetchAndRender()`,
 * disparada tanto por cada setter (cuando el otro repositorio ya está
 * asignado) como por `connectedCallback()` (por si ya estaban asignados
 * antes de insertar el elemento en el documento). Un `_loading` inicial
 * evita parpadeos mientras se resuelve `avatarUrl` (async, vía
 * `getPhotoUrl` dentro de `loadProfile`).
 */
import { BaseElement } from '../shared/base-element.js';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { VehicleType } from '../shared/models/profile.types.js';
import { loadProfile, loadRouteStats, applyProfileEditResult, saveVehicle, type ProfileViewModel } from './profile.service.js';
import type { ProfileStats } from './profile.transform.js';
import { buildProfileHeader } from './profile-header.js';
import { openProfileEditDialog } from './profile-edit-dialog.element.js';
import { openVehicleEditDialog } from './profile-vehicle-dialog.element.js';
import { VEHICLE_TYPE_LABELS } from './profile-vehicle-dialog-fields.js';
import { formatDuration } from '../shared/utils/format.js';
import { getApiBaseUrl } from '../shared/http/api-config.js';
import { loadAuthSectionState, type AuthSectionState } from '../auth/auth-section.service.js';
import { buildAuthSection } from '../auth/auth-section.js';
import { openLoginDialog } from '../auth/auth-login-dialog.element.js';
import { openRegisterDialog } from '../auth/auth-register-dialog.element.js';
import { openForgotPasswordDialog } from '../auth/auth-forgot-password-dialog.element.js';
import styles from './profile.element.css?inline';

const EMPTY_AUTH_STATE: AuthSectionState = { status: 'logged-out' };

const EMPTY_VIEW_MODEL: ProfileViewModel = { avatarUrl: null, name: null, vehicle: null };

/**
 * Vehículo con los tres campos garantizados no nulos — a diferencia del tipo
 * de `ProfileViewModel['vehicle']` (`Pick<Profile, ...>`, con los campos
 * nullable a nivel de `Profile`), esta forma refleja la garantía real que
 * ya aplica `resolveVehicle()` (`profile.service.ts`): solo se considera un
 * vehículo "configurado" cuando los tres campos están presentes a la vez.
 */
interface ConfiguredVehicle {
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
}

class ProfileView extends BaseElement {
  private _repository: IRouteRepository | null = null;
  private _profileRepository: IProfileRepository | null = null;
  private _sessionRepository: ISessionRepository | null = null;
  private _loading = false;
  private viewModel: ProfileViewModel = EMPTY_VIEW_MODEL;
  private stats: ProfileStats | null = null;
  private authState: AuthSectionState = EMPTY_AUTH_STATE;

  set repository(repo: IRouteRepository | null) {
    this._repository = repo;
    if (repo && this._profileRepository) void this.fetchAndRender();
  }

  get repository(): IRouteRepository | null {
    return this._repository;
  }

  set profileRepository(repo: IProfileRepository | null) {
    this._profileRepository = repo;
    if (repo && this._repository) void this.fetchAndRender();
  }

  get profileRepository(): IProfileRepository | null {
    return this._profileRepository;
  }

  /**
   * Independiente del gate `repository`+`profileRepository`: la sección
   * "Cuenta" no depende de esos datos, así que se resuelve por su cuenta en
   * cuanto se inyecta (mismo criterio que ADR de `pantallas-auth-mobile` —
   * no tocar la lógica de negocio ya existente de las otras secciones).
   */
  set sessionRepository(repo: ISessionRepository | null) {
    this._sessionRepository = repo;
    if (repo) void this.refreshAuthState();
  }

  get sessionRepository(): ISessionRepository | null {
    return this._sessionRepository;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    if (this._repository && this._profileRepository) {
      void this.fetchAndRender();
    }
    if (this._sessionRepository) {
      void this.refreshAuthState();
    }
  }

  private async refreshAuthState(): Promise<void> {
    const sessionRepo = this._sessionRepository;
    if (!sessionRepo) return;
    this.authState = await loadAuthSectionState(getApiBaseUrl(), sessionRepo);
    this.render();
  }

  private async handleOpenLogin(): Promise<void> {
    const sessionRepo = this._sessionRepository;
    if (!sessionRepo) return;
    const result = await openLoginDialog({ apiBaseUrl: getApiBaseUrl(), sessionRepository: sessionRepo });
    if (result === 'logged-in') await this.refreshAuthState();
  }

  private async handleOpenRegister(): Promise<void> {
    await openRegisterDialog({ apiBaseUrl: getApiBaseUrl() });
  }

  private async handleOpenForgotPassword(): Promise<void> {
    await openForgotPasswordDialog({ apiBaseUrl: getApiBaseUrl() });
  }

  private async handleLogout(): Promise<void> {
    const sessionRepo = this._sessionRepository;
    if (!sessionRepo) return;
    await sessionRepo.clear();
    this.authState = EMPTY_AUTH_STATE;
    this.render();
  }

  private buildAccountSection(): HTMLElement {
    return buildAuthSection(this.authState, {
      onOpenLogin: () => { void this.handleOpenLogin(); },
      onOpenRegister: () => { void this.handleOpenRegister(); },
      onOpenForgotPassword: () => { void this.handleOpenForgotPassword(); },
      onLogout: () => { void this.handleLogout(); },
    });
  }

  private async fetchAndRender(): Promise<void> {
    const routeRepo = this._repository;
    const profileRepo = this._profileRepository;
    if (!routeRepo || !profileRepo) return;

    this._loading = true;
    this.render();

    const [viewModel, stats] = await Promise.all([loadProfile(profileRepo), loadRouteStats(routeRepo)]);
    this.viewModel = viewModel;
    this.stats = stats;
    this._loading = false;
    this.render();
  }

  private buildLoadingState(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'profile-view__loading';
    el.setAttribute('data-cy', 'profile-view-loading');
    el.textContent = 'Cargando perfil…';
    return el;
  }

  protected render(): void {
    const screen = document.createElement('div');
    screen.className = 'profile-view';
    if (this._loading) {
      screen.appendChild(this.buildLoadingState());
    } else {
      screen.appendChild(this.buildHeaderSection());
      screen.appendChild(this.buildVehicleSection());
      screen.appendChild(this.buildStatsSection());
      screen.appendChild(this.buildAccountSection());
    }
    this.renderShadow(styles, screen);
  }

  private buildHeaderSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'header-section';
    section.appendChild(
      buildProfileHeader({
        avatarUrl: this.viewModel.avatarUrl,
        name: this.viewModel.name,
        onAvatarClick: () => { void this.handleEditProfile(); },
      }),
    );
    section.appendChild(this.buildEditProfileButton());
    return section;
  }

  private buildEditProfileButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'edit-btn';
    btn.setAttribute('data-cy', 'profile-btn-editar-perfil');
    btn.textContent = 'Editar';
    btn.addEventListener('click', () => { void this.handleEditProfile(); });
    return btn;
  }

  /** Abre el modal "Editar perfil" (AC-004) y, si se guarda, refresca la vista sin recargar la página (AC-009). */
  private async handleEditProfile(): Promise<void> {
    const profileRepo = this._profileRepository;
    if (!profileRepo) return;

    const result = await openProfileEditDialog({
      avatarUrl: this.viewModel.avatarUrl,
      name: this.viewModel.name,
      onSave: async (saveResult) => {
        await applyProfileEditResult(profileRepo, saveResult);
      },
    });

    if (result === 'saved') {
      await this.fetchAndRender();
    }
  }

  private buildVehicleSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'vehicle-section';

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = 'Mi vehículo';
    section.appendChild(title);

    const { vehicle } = this.viewModel;
    const configured =
      vehicle?.vehicleType && vehicle.vehicleMake && vehicle.vehicleModel
        ? { vehicleType: vehicle.vehicleType, vehicleMake: vehicle.vehicleMake, vehicleModel: vehicle.vehicleModel }
        : null;
    section.appendChild(configured ? this.buildVehicleDetails(configured) : this.buildVehicleEmpty());
    return section;
  }

  private buildVehicleEmpty(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'vehicle-empty';
    wrapper.setAttribute('data-cy', 'profile-vehicle-empty');

    const text = document.createElement('p');
    text.className = 'vehicle-empty-text';
    text.textContent = 'Sin vehículo configurado';
    wrapper.appendChild(text);

    wrapper.appendChild(this.buildEditVehicleButton());
    return wrapper;
  }

  private buildVehicleDetails(vehicle: ConfiguredVehicle): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'vehicle-details';

    const summary = document.createElement('p');
    summary.className = 'vehicle-summary';
    summary.setAttribute('data-cy', 'profile-vehicle-summary');
    summary.textContent = `${VEHICLE_TYPE_LABELS[vehicle.vehicleType]} · ${vehicle.vehicleMake} ${vehicle.vehicleModel}`;
    wrapper.appendChild(summary);

    wrapper.appendChild(this.buildEditVehicleButton());
    return wrapper;
  }

  private buildEditVehicleButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'edit-btn';
    btn.setAttribute('data-cy', 'profile-btn-editar-vehiculo');
    btn.textContent = this.viewModel.vehicle ? 'Editar vehículo' : 'Añadir vehículo';
    btn.addEventListener('click', () => { void this.handleEditVehicle(); });
    return btn;
  }

  /** Abre el modal "Editar vehículo" (AC-016) y, si se guarda, refresca la vista sin volver a consultar vPIC (AC-021, AC-024). */
  private async handleEditVehicle(): Promise<void> {
    const profileRepo = this._profileRepository;
    if (!profileRepo) return;

    const result = await openVehicleEditDialog({ current: this.viewModel.vehicle });
    if (result.action !== 'save') return;

    await saveVehicle(profileRepo, {
      vehicleType: result.vehicleType,
      vehicleMake: result.vehicleMake,
      vehicleModel: result.vehicleModel,
    });
    await this.fetchAndRender();
  }

  private buildStatsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'stats-section';

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = 'Estadísticas';
    section.appendChild(title);

    section.appendChild(this.stats ? this.buildStatGrid(this.stats) : this.buildStatsEmpty());
    return section;
  }

  private buildStatsEmpty(): HTMLElement {
    const empty = document.createElement('p');
    empty.className = 'stats-empty';
    empty.setAttribute('data-cy', 'profile-stats-empty');
    empty.textContent = 'Todavía no hay rutas completadas';
    return empty;
  }

  private buildStatGrid(stats: ProfileStats): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'stat-grid';
    grid.appendChild(this.buildStatTile('profile-stat-km-totales', 'Km totales', stats.totalDistanceKm.toFixed(1), 'km'));
    grid.appendChild(
      this.buildStatTile('profile-stat-tiempo-total', 'Tiempo total', formatDuration(stats.totalDurationSeconds)),
    );
    grid.appendChild(
      this.buildStatTile(
        'profile-stat-ruta-mas-larga',
        'Ruta más larga',
        stats.longestRoute.name,
        `${stats.longestRoute.distanceKm.toFixed(1)} km`,
      ),
    );
    grid.appendChild(this.buildStatTile('profile-stat-num-rutas', 'Nº de rutas', String(stats.routeCount)));
    grid.appendChild(
      this.buildStatTile('profile-stat-vel-media', 'Vel. media histórica', stats.avgSpeedHistoric.toFixed(1), 'km/h'),
    );
    return grid;
  }

  private buildStatTile(dataCy: string, label: string, value: string, unit?: string): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'stat-tile';
    tile.setAttribute('data-cy', dataCy);

    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    tile.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'stat-value';
    valueEl.textContent = value;
    if (unit) {
      const unitEl = document.createElement('span');
      unitEl.className = 'stat-unit';
      unitEl.textContent = ` ${unit}`;
      valueEl.appendChild(unitEl);
    }
    tile.appendChild(valueEl);

    return tile;
  }
}

customElements.define('profile-view', ProfileView);
