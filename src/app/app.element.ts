import '../cockpit/cockpit.element.js';
import '../components/nav-bar/nav-bar.element.js';
import '../routes/route-list.element.js';
import '../routes/route-detail.element.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';

class AppRoot extends HTMLElement {
  private repo: IRouteRepository = new MemoryRouteRepository();
  private cockpitEl: HTMLElement | null = null;
  private routeListEl: HTMLElement | null = null;
  private routeDetailEl: HTMLElement | null = null;

  private readonly onGrabar = (): void => { this.showView('cockpit'); };
  private readonly onRutas = (): void => { this.showView('routes'); };
  private readonly onViewRoute = (e: Event): void => {
    const routeId = (e as CustomEvent).detail.routeId as string;
    if (this.routeDetailEl) {
      (this.routeDetailEl as HTMLElement & { routeId: string }).routeId = routeId;
      this.showView('detail');
    }
  };
  private readonly onBackToList = (): void => { this.showView('routes'); };

  connectedCallback(): void {
    window.addEventListener('nav-grabar', this.onGrabar);
    window.addEventListener('nav-rutas', this.onRutas);
    window.addEventListener('view-route', this.onViewRoute);
    window.addEventListener('back-to-list', this.onBackToList);
    void this.init();
  }

  disconnectedCallback(): void {
    window.removeEventListener('nav-grabar', this.onGrabar);
    window.removeEventListener('nav-rutas', this.onRutas);
    window.removeEventListener('view-route', this.onViewRoute);
    window.removeEventListener('back-to-list', this.onBackToList);
  }

  private async init(): Promise<void> {
    try {
      const sqliteDb = await createSqliteDb();
      this.repo = new SqliteRouteRepository(sqliteDb);
    } catch {
      this.repo = new MemoryRouteRepository();
    }
    this.buildUI();
  }

  private buildUI(): void {
    this.style.cssText = 'display:block;height:100dvh;overflow:hidden;position:relative;';

    const cockpit = document.createElement('cockpit-view') as HTMLElement & { repository: IRouteRepository };
    cockpit.repository = this.repo;
    cockpit.style.cssText = 'position:absolute;inset:0;bottom:var(--nav-height);';
    this.cockpitEl = cockpit;
    this.appendChild(cockpit);

    const routeList = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
    routeList.repository = this.repo;
    routeList.style.cssText = 'position:absolute;inset:0;bottom:var(--nav-height);display:none;';
    this.routeListEl = routeList;
    this.appendChild(routeList);

    const routeDetail = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    routeDetail.repository = this.repo;
    routeDetail.style.cssText = 'position:absolute;inset:0;bottom:var(--nav-height);display:none;';
    this.routeDetailEl = routeDetail;
    this.appendChild(routeDetail);

    const navBar = document.createElement('nav-bar');
    navBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100;';
    this.appendChild(navBar);
  }

  private showView(view: 'cockpit' | 'routes' | 'detail'): void {
    if (this.cockpitEl) this.cockpitEl.style.display = view === 'cockpit' ? '' : 'none';
    if (this.routeListEl) this.routeListEl.style.display = view === 'routes' ? '' : 'none';
    if (this.routeDetailEl) this.routeDetailEl.style.display = view === 'detail' ? '' : 'none';
  }
}

customElements.define('app-root', AppRoot);