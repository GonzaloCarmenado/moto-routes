import '../cockpit/cockpit.element.js';
import '../components/nav-bar/nav-bar.element.js';
import '../routes/route-list.element.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import { SqliteRouteRepository } from '../shared/repositories/sqlite-route.repository.js';
import { createSqliteDb } from '../shared/repositories/sqlite-route.factory.js';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';

type ViewName = 'cockpit' | 'routes' | 'profile';

class AppRoot extends HTMLElement {
  private currentView: ViewName = 'cockpit';
  private repo: IRouteRepository = new MemoryRouteRepository();

  async connectedCallback(): Promise<void> {
    await this.initRepo();
    this.render();
  }

  private async initRepo(): Promise<void> {
    try {
      const sqliteDb = await createSqliteDb();
      this.repo = new SqliteRouteRepository(sqliteDb);
    } catch {
      this.repo = new MemoryRouteRepository();
    }
  }

  private navigateTo(view: ViewName): void {
    this.currentView = view;
    this.render();
  }

  private render(): void {
    this.innerHTML = '';

    if (this.currentView === 'cockpit') {
      const cockpit = document.createElement('cockpit-view') as HTMLElement & { repository: IRouteRepository };
      cockpit.repository = this.repo;
      this.appendChild(cockpit);
    } else if (this.currentView === 'routes') {
      const routeList = document.createElement('route-list') as HTMLElement & { repository: IRouteRepository };
      routeList.repository = this.repo;
      this.appendChild(routeList);
    }

    const navBar = document.createElement('nav-bar');
    navBar.addEventListener('nav-grabar', () => { this.navigateTo('cockpit'); });
    navBar.addEventListener('nav-rutas', () => { this.navigateTo('routes'); });
    this.appendChild(navBar);
  }
}

customElements.define('app-root', AppRoot);