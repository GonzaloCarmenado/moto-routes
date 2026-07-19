import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import './route-detail.element.js';

// Mock MapLibre para tests (route-map.element.ts internamente instancia el mapa)
vi.mock('maplibre-gl', () => {
  const mockMap = {
    remove: vi.fn(),
    fitBounds: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') cb();
    }),
  };
  const mapFn = vi.fn(() => mockMap);
  const markerFn = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
  }));
  return {
    default: { Map: mapFn, Marker: markerFn },
    Map: mapFn,
    Marker: markerFn,
  };
});

async function waitRender(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => { resolve(); }));
  await new Promise((r) => setTimeout(r, 0));
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

    const title = root.querySelector('.detail-title');
    expect(title).not.toBeNull();

    const date = root.querySelector('.detail-date');
    expect(date).not.toBeNull();

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

  it('should render a route-map element and pass it the loaded GPS points', async () => {
    const points = [
      { routeId: '', timestamp: Date.now(), lat: 40.4168, lng: -3.7038, alt: 650, speed: 0 },
      { routeId: '', timestamp: Date.now() + 1000, lat: 40.4170, lng: -3.7035, alt: 650, speed: 10 },
    ];
    const pointRoute = await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      points,
      [],
    );

    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = pointRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const routeMap = root.querySelector<HTMLElement & { points: { lat: number; lng: number }[] }>('route-map');
    expect(routeMap).not.toBeNull();
    expect(routeMap?.points).toEqual([
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4170, lng: -3.7035 },
    ]);
    document.body.removeChild(el);
  });

  it('should render a route-map element with an empty points array when the route has no GPS points', async () => {
    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = savedRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const routeMap = root.querySelector<HTMLElement & { points: { lat: number; lng: number }[] }>('route-map');
    expect(routeMap).not.toBeNull();
    expect(routeMap?.points).toEqual([]);
    document.body.removeChild(el);
  });
});