import '../cockpit/cockpit.element.js';
import '../shared/nav-bar/nav-bar.element.js';
import '../routes/list/route-list.element.js';
import '../routes/detail/route-detail.element.js';
import '../routes/sharing/route-sharing.element.js';
import '../achievements/achievement-list.element.js';
import '../friends/friends-view.element.js';
import '../profile/profile.element.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import type { IStopTypesCacheRepository } from '../shared/models/stop-types-cache.repository.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import type { Session } from '../shared/models/session.types.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { SqliteProfileRepository } from '../shared/repositories/sqlite-profile.repository.js';
import { createSqliteProfileDb } from '../shared/repositories/sqlite-profile.factory.js';
import { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';
import { SqliteSessionRepository } from '../shared/repositories/sqlite-session.repository.js';
import { createSqliteSessionDb } from '../shared/repositories/sqlite-session.factory.js';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';
import { MemoryStopTypesCacheRepository } from '../shared/repositories/memory-stop-types-cache.repository.js';
import { createStopTypesCacheRepository } from '../shared/repositories/sqlite-stop-types-cache.factory.js';
import { refreshStopTypesCache } from '../shared/stop-types/stop-types.service.js';
import { fetchStopTypesFromApi } from '../shared/stop-types/stop-types-api.service.js';
import { getApiBaseUrl } from '../shared/http/api-config.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, dispatchAppEvent, type AppEventDetailMap } from '../shared/app-events.js';
import { isTauri } from '../shared/services/photo-capture-adapter.service.js';
import { listenForNotificationTaps } from '../shared/services/notification-tap.service.js';
import { reregisterDeviceTokenAfterRefresh } from '../shared/services/device-token.service.js';
import { getPendingTapScreen, clearPendingTapScreen } from '../shared/tauri/commands.js';
import { applyCypressSeed } from './app-seed.service.js';
import { handleRouteSaved } from './app-route-upload.js';
import type { NavBarActiveView } from '../shared/nav-bar/nav-bar.element.js';
import { resolveUsernameGateSession } from './app-username-gate.js';
import '../auth/username-form.element.js';
import { USERNAME_FORM_SUCCESS_EVENT } from '../auth/username-form.types.js';
import { mountUpdateBanner, checkForUpdateAndReflect } from './app-update-banner.js';

/** Vista interna de `app-root` (7 vistas — `nav-bar` solo entiende 3, ver `navViewFor`).
 * `username-gate` es una séptima vista sin acceso desde `nav-bar` (ver nombre-usuario,
 * design.md Decisión 3): se muestra en vez de `cockpit` al arrancar si la cuenta con
 * sesión activa todavía no tiene username fijado, bloqueando el resto de la app. */
type AppView = 'cockpit' | 'routes' | 'detail' | 'profile' | 'sharing' | 'achievements' | 'friends' | 'username-gate';

/**
 * Traduce las 6 vistas internas de `app-root` que sí tienen barra de
 * navegación a las 3 que entiende `<nav-bar>` (AC-036): el detalle de ruta y
 * la pantalla de invitaciones son sub-vistas de "Rutas"; "Mis logros" es
 * sub-vista de "Perfil" (se abre desde ahí). `username-gate` nunca llega
 * aquí — `showView()` oculta `<nav-bar>` por completo mientras está activa.
 */
function navViewFor(view: Exclude<AppView, 'username-gate'>): NavBarActiveView {
  if (view === 'detail' || view === 'sharing') return 'routes';
  if (view === 'achievements' || view === 'friends') return 'profile';
  return view;
}

class AppRoot extends BaseElement {
  private repo: IRouteRepository = new MemoryRouteRepository();
  private profileRepo: IProfileRepository = new MemoryProfileRepository();
  private sessionRepo: ISessionRepository = new MemorySessionRepository();
  private stopTypesCacheRepo: IStopTypesCacheRepository = new MemoryStopTypesCacheRepository();
  private cockpitEl: HTMLElement | null = null;
  private routeListEl: HTMLElement | null = null;
  private routeDetailEl: HTMLElement | null = null;
  private profileEl: HTMLElement | null = null;
  private sharingEl: HTMLElement | null = null;
  private achievementsEl: HTMLElement | null = null;
  private friendsEl: HTMLElement | null = null;
  private navBarEl: HTMLElement | null = null;
  private updateBannerEl: HTMLElement | null = null;
  private usernameGateEl: HTMLElement | null = null;
  /** `true` mientras la cuenta con sesión activa no tiene username fijado —
   * bloquea la navegación por `<nav-bar>` (ver nombre-usuario, design.md
   * Decisión 3), nunca se accede al resto de la app hasta fijarlo. */
  private usernameGateActive = false;

  private readonly onGrabar = (): void => { if (!this.usernameGateActive) this.showView('cockpit'); };
  private readonly onRutas = (): void => { if (!this.usernameGateActive) this.showView('routes'); };
  private readonly onPerfil = (): void => { if (!this.usernameGateActive) this.showView('profile'); };
  private readonly onViewRoute = (e: Event): void => {
    const routeId = (e as CustomEvent<AppEventDetailMap['view-route']>).detail.routeId;
    if (this.routeDetailEl) {
      (this.routeDetailEl as HTMLElement & { routeId: string }).routeId = routeId;
      this.showView('detail');
    }
  };
  private readonly onViewSharing = (): void => { this.showView('sharing'); };
  private readonly onViewAchievements = (): void => { this.showView('achievements'); };
  private readonly onViewFriends = (): void => { this.showView('friends'); };
  private readonly onBackToList = (): void => { this.showView('routes'); };
  /** Re-comprueba el bloqueo por username sin fijar tras un login interactivo — ver `checkUsernameGate()`. */
  private readonly onAuthLoggedIn = (): void => { void this.checkUsernameGate(); };
  /** Intenta la subida automática de una ruta recién guardada — ver `app-route-upload.ts` (subida-automatica-rutas). */
  private readonly onRouteSaved = (e: Event): void => {
    const { routeId } = (e as CustomEvent<AppEventDetailMap['route-saved']>).detail;
    void handleRouteSaved({ apiBaseUrl: getApiBaseUrl(), sessionRepository: this.sessionRepo, repository: this.repo, routeId });
  };
  private unlistenNotificationTap: (() => void) | null = null;

  connectedCallback(): void {
    window.addEventListener(APP_EVENTS.NAV_GRABAR, this.onGrabar);
    window.addEventListener(APP_EVENTS.NAV_RUTAS, this.onRutas);
    window.addEventListener(APP_EVENTS.NAV_PERFIL, this.onPerfil);
    window.addEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.addEventListener(APP_EVENTS.VIEW_SHARING, this.onViewSharing);
    window.addEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, this.onViewAchievements);
    window.addEventListener(APP_EVENTS.VIEW_FRIENDS, this.onViewFriends);
    window.addEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
    window.addEventListener(APP_EVENTS.AUTH_LOGGED_IN, this.onAuthLoggedIn);
    window.addEventListener(APP_EVENTS.ROUTE_SAVED, this.onRouteSaved);
    // Tocar una notificación push de invitación abre la app directamente en
    // Invitaciones (notificaciones-push-fcm) — dispara el mismo evento
    // `VIEW_SHARING` que el icono de invitaciones del listado (no basta con
    // llamar a `onViewSharing()` directamente: `route-sharing.element.ts`
    // también escucha este evento en `window` para refrescar sus datos, y
    // esa segunda escucha se saltaba si no se redisparaba el evento real).
    this.unlistenNotificationTap = listenForNotificationTaps(() => {
      dispatchAppEvent(APP_EVENTS.VIEW_SHARING);
    });
    void this.init();
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.NAV_GRABAR, this.onGrabar);
    window.removeEventListener(APP_EVENTS.NAV_RUTAS, this.onRutas);
    window.removeEventListener(APP_EVENTS.NAV_PERFIL, this.onPerfil);
    window.removeEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.removeEventListener(APP_EVENTS.VIEW_SHARING, this.onViewSharing);
    window.removeEventListener(APP_EVENTS.VIEW_ACHIEVEMENTS, this.onViewAchievements);
    window.removeEventListener(APP_EVENTS.VIEW_FRIENDS, this.onViewFriends);
    window.removeEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
    window.removeEventListener(APP_EVENTS.AUTH_LOGGED_IN, this.onAuthLoggedIn);
    window.removeEventListener(APP_EVENTS.ROUTE_SAVED, this.onRouteSaved);
    this.unlistenNotificationTap?.();
  }

  /** Extraído de `render()` para no superar el límite de statements de la función (ESLint `max-statements`). */
  private buildCockpitView(): HTMLElement {
    const cockpit = document.createElement('cockpit-view') as HTMLElement & {
      repository: IRouteRepository;
      stopTypesCacheRepository: IStopTypesCacheRepository;
    };
    cockpit.repository = this.repo;
    cockpit.stopTypesCacheRepository = this.stopTypesCacheRepo;
    cockpit.className = 'app-view';
    return cockpit;
  }

  /** Extraído de `render()` por el mismo motivo que `buildCockpitView()`. */
  private buildRouteListView(): HTMLElement {
    const routeList = document.createElement('route-list') as HTMLElement & {
      repository: IRouteRepository;
      sessionRepository: ISessionRepository;
    };
    routeList.sessionRepository = this.sessionRepo;
    routeList.repository = this.repo;
    routeList.className = 'app-view';
    return routeList;
  }

  /** Extraído de `render()` para no superar el límite de statements de la función (ESLint `max-statements`). */
  private buildRouteDetailView(): HTMLElement {
    const routeDetail = document.createElement('route-detail') as HTMLElement & {
      repository: IRouteRepository;
      routeId: string;
      stopTypesCacheRepository: IStopTypesCacheRepository;
      sessionRepository: ISessionRepository;
    };
    routeDetail.sessionRepository = this.sessionRepo;
    routeDetail.repository = this.repo;
    routeDetail.stopTypesCacheRepository = this.stopTypesCacheRepo;
    routeDetail.className = 'app-view';
    return routeDetail;
  }

  /**
   * Construye una vista cuyo único dato de entrada es `sessionRepository`
   * (`route-sharing`, `achievement-list`, `friends-view`) — factorizado de
   * `render()` para no repetir el mismo patrón de 4 líneas tres veces.
   */
  private buildSessionOnlyView(tagName: string): HTMLElement {
    const el = document.createElement(tagName) as HTMLElement & { sessionRepository: ISessionRepository };
    el.sessionRepository = this.sessionRepo;
    el.className = 'app-view';
    return el;
  }

  /** Extraído de `render()` para mantener su recuento de sentencias bajo el límite del proyecto. */
  private buildProfileView(): HTMLElement {
    const profile = document.createElement('profile-view') as HTMLElement & {
      repository: IRouteRepository;
      profileRepository: IProfileRepository;
      sessionRepository: ISessionRepository;
    };
    profile.repository = this.repo;
    profile.profileRepository = this.profileRepo;
    profile.sessionRepository = this.sessionRepo;
    profile.className = 'app-view';
    return profile;
  }

  /**
   * Pantalla de bloqueo para una cuenta con sesión activa sin username
   * (nombre-usuario, design.md Decisión 3) — solo `<username-form>`, sin
   * botón de cancelar ni acceso al resto de la app hasta fijarlo con éxito.
   */
  private buildUsernameGateView(session: Session): HTMLElement {
    const view = document.createElement('div');
    view.className = 'app-view username-gate';
    view.setAttribute('data-cy', 'username-gate');

    const title = document.createElement('h1');
    title.className = 'username-gate__title';
    title.textContent = 'Elige tu nombre de usuario';
    view.appendChild(title);

    const message = document.createElement('p');
    message.className = 'username-gate__message';
    message.textContent = 'Lo necesitamos para poder identificarte — podrás cambiarlo después desde tu perfil.';
    view.appendChild(message);

    const form = document.createElement('username-form') as HTMLElement & {
      apiBaseUrl: string;
      token: string;
      currentUsername: string | null;
    };
    form.apiBaseUrl = getApiBaseUrl();
    form.token = session.token;
    form.currentUsername = null;
    form.addEventListener(USERNAME_FORM_SUCCESS_EVENT, () => {
      this.usernameGateActive = false;
      this.refreshProfileAccountState();
      this.showView('cockpit');
    });
    view.appendChild(form);

    return view;
  }

  /**
   * Fuerza que la sección "Cuenta" de `<profile-view>` recargue su estado tras
   * fijar el username desde la pantalla de bloqueo — a diferencia del resto
   * de vistas, `profile-view` se construye una única vez en `init()` y solo
   * alterna su visibilidad (`showView()`), así que su `connectedCallback` no
   * vuelve a dispararse al navegar a Perfil después: sin este empujón se
   * quedaría mostrando "Sin nombre de usuario" hasta el próximo arranque en
   * frío (gap real encontrado verificando 7.2 en Cypress). Reasignar
   * `sessionRepository` reutiliza el refresco que ya dispara su propio setter
   * (`profile.element.ts`), sin duplicar esa lógica aquí.
   */
  private refreshProfileAccountState(): void {
    if (!this.profileEl) return;
    (this.profileEl as HTMLElement & { sessionRepository: ISessionRepository }).sessionRepository = this.sessionRepo;
  }

  /** Construye y muestra la pantalla de bloqueo bajo demanda (depende de la
   * sesión, resuelta de forma asíncrona tras el primer `render()`, a
   * diferencia del resto de vistas — ver `init()`). */
  private showUsernameGate(session: Session): void {
    this.usernameGateActive = true;
    const gate = this.buildUsernameGateView(session);
    this.usernameGateEl = gate;
    this.appendChild(gate);
    this.showView('username-gate');
  }

  /**
   * Comprueba el bloqueo por username sin fijar (nombre-usuario, design.md
   * Decisión 3) — se llama tanto desde `init()` (arranque en frío con sesión
   * ya persistida) como desde `onAuthLoggedIn` (login interactivo dentro de
   * una sesión de app ya abierta, ver `profile-account.ts::handleOpenLogin`).
   * Best-effort: un fallo de red (Decisión 4) deja pasar sin bloqueo.
   */
  private async checkUsernameGate(): Promise<void> {
    if (this.usernameGateActive) return;
    const session = await resolveUsernameGateSession({ apiBaseUrl: getApiBaseUrl(), sessionRepository: this.sessionRepo });
    if (session) this.showUsernameGate(session);
  }

  // Decide primero por isTauri() (en vez de por éxito/fracaso del intento de SQLite)
  // para que la siembra de rutas de test sea determinista y no dependa de si, por
  // casualidad, hay un plugin SQL cargable en el navegador de pruebas (AC-007/AC-010).
  private async init(): Promise<void> {
    if (isTauri()) {
      try {
        const sqliteDb = await createSqliteDb();
        this.repo = new SqliteRouteRepository(sqliteDb);
      } catch {
        this.repo = new MemoryRouteRepository();
      }
      try {
        const sqliteProfileDb = await createSqliteProfileDb();
        this.profileRepo = new SqliteProfileRepository(sqliteProfileDb);
      } catch {
        this.profileRepo = new MemoryProfileRepository();
      }
      try {
        const sqliteSessionDb = await createSqliteSessionDb();
        this.sessionRepo = new SqliteSessionRepository(sqliteSessionDb);
      } catch {
        this.sessionRepo = new MemorySessionRepository();
      }
      this.stopTypesCacheRepo = await createStopTypesCacheRepository();
    } else {
      const memRepo = new MemoryRouteRepository();
      const memProfileRepo = new MemoryProfileRepository();
      applyCypressSeed(memRepo, memProfileRepo);
      this.repo = memRepo;
      this.profileRepo = memProfileRepo;
    }
    this.render();

    // Cold start vía tap de notificación (ver MainActivity.kt::onCreate): el
    // tap real pudo perderse porque `listenForNotificationTaps` aún no
    // estaba escuchando cuando Android creó la Activity. Se consulta y
    // consume aquí, una vez la vista de invitaciones (con su propio listener
    // de VIEW_SHARING para refrescar datos) ya está montada por `render()`.
    void getPendingTapScreen().then((screen) => {
      if (screen === 'sharing') {
        dispatchAppEvent(APP_EVENTS.VIEW_SHARING);
        void clearPendingTapScreen();
      }
    });

    // Re-registro del token FCM tras una rotación (design.md Decisión 6):
    // solo tiene sentido con sesión activa — sin sesión no hay a qué
    // usuario asociar el token nuevo en `device_tokens`.
    void this.sessionRepo.get().then((session) => {
      if (session) void reregisterDeviceTokenAfterRefresh(getApiBaseUrl(), session);
    });

    // Bloqueo por username sin fijar (nombre-usuario, design.md Decisión 3):
    // best-effort, igual que el resto de comprobaciones en segundo plano de
    // este método — un fallo de red (Decisión 4) deja la app arrancar con
    // normalidad, sin bloqueo, en vez de dejarla inutilizable.
    void this.checkUsernameGate();

    // Best-effort, en segundo plano: no bloquea el arranque ni el primer render.
    // Si falla (sin red, apps/api no disponible), la caché existente se queda tal
    // cual — ver refreshStopTypesCache.
    void refreshStopTypesCache({
      cache: this.stopTypesCacheRepo,
      fetchFromApi: fetchStopTypesFromApi,
      apiBaseUrl: getApiBaseUrl(),
    });

    // Comprobación de actualización (actualizacion-in-app): best-effort, igual
    // que el resto de comprobaciones de este método — ver app-update-banner.ts.
    if (this.updateBannerEl) checkForUpdateAndReflect(this.updateBannerEl);
  }

  // app-root monta las vistas en su DOM ligero (no usa Shadow DOM). El layout
  // (posición y visibilidad de las vistas) vive en index.css: `app-root`,
  // `app-root > .app-view` y `app-root > nav-bar`.
  protected render(): void {
    const cockpit = this.buildCockpitView();
    this.cockpitEl = cockpit;
    this.appendChild(cockpit);

    const routeList = this.buildRouteListView();
    this.routeListEl = routeList;
    this.appendChild(routeList);

    const routeDetail = this.buildRouteDetailView();
    this.routeDetailEl = routeDetail;
    this.appendChild(routeDetail);

    const profile = this.buildProfileView();
    this.profileEl = profile;
    this.appendChild(profile);

    const sharing = this.buildSessionOnlyView('route-sharing');
    this.sharingEl = sharing;
    this.appendChild(sharing);

    const achievements = this.buildSessionOnlyView('achievement-list');
    this.achievementsEl = achievements;
    this.appendChild(achievements);

    const friends = this.buildSessionOnlyView('friends-view');
    this.friendsEl = friends;
    this.appendChild(friends);

    this.navBarEl = document.createElement('nav-bar');
    this.appendChild(this.navBarEl);

    this.updateBannerEl = mountUpdateBanner(this);

    // Estado inicial de visibilidad (cockpit visible, resto oculto).
    this.showView('cockpit');
  }

  // El toggle de `display` es dinámico (cambia en runtime al navegar), por eso
  // se mantiene como estilo en línea y no como clase CSS.
  private showView(view: AppView): void {
    if (this.cockpitEl) this.cockpitEl.style.display = view === 'cockpit' ? '' : 'none';
    if (this.routeListEl) this.routeListEl.style.display = view === 'routes' ? '' : 'none';
    if (this.routeDetailEl) this.routeDetailEl.style.display = view === 'detail' ? '' : 'none';
    if (this.profileEl) this.profileEl.style.display = view === 'profile' ? '' : 'none';
    if (this.sharingEl) this.sharingEl.style.display = view === 'sharing' ? '' : 'none';
    if (this.achievementsEl) this.achievementsEl.style.display = view === 'achievements' ? '' : 'none';
    if (this.friendsEl) this.friendsEl.style.display = view === 'friends' ? '' : 'none';
    if (this.usernameGateEl) this.usernameGateEl.style.display = view === 'username-gate' ? '' : 'none';
    if (this.navBarEl) {
      if (view === 'username-gate') {
        this.navBarEl.style.display = 'none';
      } else {
        this.navBarEl.style.display = '';
        (this.navBarEl as HTMLElement & { activeView: NavBarActiveView }).activeView = navViewFor(view);
      }
    }
  }
}

customElements.define('app-root', AppRoot);