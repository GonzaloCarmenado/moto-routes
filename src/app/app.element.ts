import '../cockpit/cockpit.element.js';
import '../components/nav-bar/nav-bar.element.js';
import '../routes/list/route-list.element.js';
import '../routes/detail/route-detail.element.js';
import '../profile/profile.element.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { IProfileRepository } from '../shared/models/profile.repository.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { SqliteProfileRepository } from '../shared/repositories/sqlite-profile.repository.js';
import { createSqliteProfileDb } from '../shared/repositories/sqlite-profile.factory.js';
import { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, type AppEventDetailMap } from '../shared/app-events.js';
import { isTauri } from '../shared/services/photo-capture-adapter.service.js';
import { applyCypressSeed } from './app-seed.service.js';
import type { NavBarActiveView } from '../components/nav-bar/nav-bar.element.js';

/** Vista interna de `app-root` (4 vistas — `nav-bar` solo entiende 3, ver `navViewFor`). */
type AppView = 'cockpit' | 'routes' | 'detail' | 'profile';

/**
 * Traduce las 4 vistas internas de `app-root` a las 3 que entiende `<nav-bar>`
 * (AC-036): el detalle de ruta es una sub-vista de "Rutas", así que se marca
 * "Rutas" como activo mientras se visualiza un detalle.
 */
function navViewFor(view: AppView): NavBarActiveView {
  return view === 'detail' ? 'routes' : view;
}

class AppRoot extends BaseElement {
  private repo: IRouteRepository = new MemoryRouteRepository();
  private profileRepo: IProfileRepository = new MemoryProfileRepository();
  private cockpitEl: HTMLElement | null = null;
  private routeListEl: HTMLElement | null = null;
  private routeDetailEl: HTMLElement | null = null;
  private profileEl: HTMLElement | null = null;
  private navBarEl: HTMLElement | null = null;

  private readonly onGrabar = (): void => { this.showView('cockpit'); };
  private readonly onRutas = (): void => { this.showView('routes'); };
  private readonly onPerfil = (): void => { this.showView('profile'); };
  private readonly onViewRoute = (e: Event): void => {
    const routeId = (e as CustomEvent<AppEventDetailMap['view-route']>).detail.routeId;
    if (this.routeDetailEl) {
      (this.routeDetailEl as HTMLElement & { routeId: string }).routeId = routeId;
      this.showView('detail');
    }
  };
  private readonly onBackToList = (): void => { this.showView('routes'); };

  connectedCallback(): void {
    window.addEventListener(APP_EVENTS.NAV_GRABAR, this.onGrabar);
    window.addEventListener(APP_EVENTS.NAV_RUTAS, this.onRutas);
    window.addEventListener(APP_EVENTS.NAV_PERFIL, this.onPerfil);
    window.addEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.addEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
    void this.init();
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.NAV_GRABAR, this.onGrabar);
    window.removeEventListener(APP_EVENTS.NAV_RUTAS, this.onRutas);
    window.removeEventListener(APP_EVENTS.NAV_PERFIL, this.onPerfil);
    window.removeEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.removeEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
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
    } else {
      const memRepo = new MemoryRouteRepository();
      applyCypressSeed(memRepo);
      this.repo = memRepo;
      this.profileRepo = new MemoryProfileRepository();
    }
    this.render();
  }

  // app-root monta las vistas en su DOM ligero (no usa Shadow DOM). El layout
  // (posición y visibilidad de las vistas) vive en index.css: `app-root`,
  // `app-root > .app-view` y `app-root > nav-bar`.
  protected render(): void {
    const cockpit = document.createElement('cockpit-view') as HTMLElement & { repository: IRouteRepository };
    cockpit.repository = this.repo;
    cockpit.className = 'app-view';
    this.cockpitEl = cockpit;
    this.appendChild(cockpit);

    const routeList = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
    routeList.repository = this.repo;
    routeList.className = 'app-view';
    this.routeListEl = routeList;
    this.appendChild(routeList);

    const routeDetail = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    routeDetail.repository = this.repo;
    routeDetail.className = 'app-view';
    this.routeDetailEl = routeDetail;
    this.appendChild(routeDetail);

    const profile = document.createElement('profile-view') as HTMLElement & {
      repository: IRouteRepository;
      profileRepository: IProfileRepository;
    };
    profile.repository = this.repo;
    profile.profileRepository = this.profileRepo;
    profile.className = 'app-view';
    this.profileEl = profile;
    this.appendChild(profile);

    this.navBarEl = document.createElement('nav-bar');
    this.appendChild(this.navBarEl);

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
    if (this.navBarEl) {
      (this.navBarEl as HTMLElement & { activeView: NavBarActiveView }).activeView = navViewFor(view);
    }
  }
}

customElements.define('app-root', AppRoot);