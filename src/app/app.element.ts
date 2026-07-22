import '../cockpit/cockpit.element.js';
import '../components/nav-bar/nav-bar.element.js';
import '../routes/route-list.element.js';
import '../routes/route-detail.element.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS, type AppEventDetailMap } from '../shared/app-events.js';

class AppRoot extends BaseElement {
  private repo: IRouteRepository = new MemoryRouteRepository();
  private cockpitEl: HTMLElement | null = null;
  private routeListEl: HTMLElement | null = null;
  private routeDetailEl: HTMLElement | null = null;

  private readonly onGrabar = (): void => { this.showView('cockpit'); };
  private readonly onRutas = (): void => { this.showView('routes'); };
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
    window.addEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.addEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
    void this.init();
  }

  disconnectedCallback(): void {
    window.removeEventListener(APP_EVENTS.NAV_GRABAR, this.onGrabar);
    window.removeEventListener(APP_EVENTS.NAV_RUTAS, this.onRutas);
    window.removeEventListener(APP_EVENTS.VIEW_ROUTE, this.onViewRoute);
    window.removeEventListener(APP_EVENTS.BACK_TO_LIST, this.onBackToList);
  }

  private async init(): Promise<void> {
    try {
      const sqliteDb = await createSqliteDb();
      this.repo = new SqliteRouteRepository(sqliteDb);
    } catch {
      this.repo = new MemoryRouteRepository();
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

    this.appendChild(document.createElement('nav-bar'));

    // Estado inicial de visibilidad (cockpit visible, resto oculto).
    this.showView('cockpit');
  }

  // El toggle de `display` es dinámico (cambia en runtime al navegar), por eso
  // se mantiene como estilo en línea y no como clase CSS.
  private showView(view: 'cockpit' | 'routes' | 'detail'): void {
    if (this.cockpitEl) this.cockpitEl.style.display = view === 'cockpit' ? '' : 'none';
    if (this.routeListEl) this.routeListEl.style.display = view === 'routes' ? '' : 'none';
    if (this.routeDetailEl) this.routeDetailEl.style.display = view === 'detail' ? '' : 'none';
  }
}

customElements.define('app-root', AppRoot);