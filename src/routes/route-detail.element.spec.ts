import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import './route-detail.element.js';

async function waitRender(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10));
}

describe('route-detail', () => {
  let repo: IRouteRepository;
  let savedRoute: Route;

  beforeEach(async () => {
    repo = new MemoryRouteRepository();
    savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
  });

  it('should show empty message when route does not exist', async () => {
    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = 'non-existent-id';
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const empty = root.querySelector('.empty-msg');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('Ruta no encontrada');
    document.body.removeChild(el);
  });

  it('should show route details when route exists', async () => {
    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = savedRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;

    // Title
    const title = root.querySelector('.detail-title');
    expect(title).not.toBeNull();

    // Date
    const date = root.querySelector('.detail-date');
    expect(date).not.toBeNull();

    // Map
    const map = root.querySelector('.route-map');
    expect(map).not.toBeNull();

    // 4 stat tiles
    const tiles = root.querySelectorAll('.stat-tile');
    expect(tiles.length).toBe(4);

    document.body.removeChild(el);
  });

  it('should emit back-to-list event when back button is clicked', async () => {
    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = savedRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const backBtn = root.querySelector('.back-btn') as HTMLButtonElement;

    const handler = vi.fn();
    window.addEventListener('back-to-list', handler);
    backBtn?.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('back-to-list', handler);
    document.body.removeChild(el);
  });
});