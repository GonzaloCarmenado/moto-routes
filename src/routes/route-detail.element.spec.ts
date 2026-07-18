import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import './route-detail.element.js';

// Mock Leaflet para tests
vi.mock('leaflet', () => {
  const mockMap = {
    remove: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn().mockReturnThis(),
  };
  const mockTileLayer = { addTo: vi.fn().mockReturnThis() };
  const mockPolyline = { getBounds: vi.fn().mockReturnValue({}), addTo: vi.fn().mockReturnThis() };
  const mockCircleMarker = { addTo: vi.fn().mockReturnThis() };
  const mapFn = vi.fn(() => mockMap);
  return {
    default: {
      map: mapFn,
      tileLayer: vi.fn(() => mockTileLayer),
      polyline: vi.fn(() => mockPolyline),
      circleMarker: vi.fn(() => mockCircleMarker),
    },
    Map: mapFn,
    TileLayer: vi.fn(() => mockTileLayer),
    Polyline: vi.fn(() => mockPolyline),
    CircleMarker: vi.fn(() => mockCircleMarker),
  };
});

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

  it('should render leaflet map container when route has GPS points', async () => {
    const pointRoute = await repo.save(
      { duration: 100, totalDistance: 10, avgSpeed: 50, status: 'completed', visibility: 'private', origin: 'local' },
      [
        { routeId: '', timestamp: Date.now(), lat: 40.4168, lng: -3.7038, alt: 650, speed: 0 },
        { routeId: '', timestamp: Date.now() + 1000, lat: 40.4170, lng: -3.7035, alt: 650, speed: 10 },
      ],
      [],
    );

    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = pointRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const mapContainer = root.querySelector('#map');
    expect(mapContainer).not.toBeNull();
    document.body.removeChild(el);
  });

  it('should show no-gps message when route has no points', async () => {
    const el = document.createElement('route-detail') as HTMLElement & { repository: IRouteRepository; routeId: string };
    el.repository = repo;
    el.routeId = savedRoute.id;
    document.body.appendChild(el);
    await waitRender();

    const root = el.shadowRoot!;
    const noGps = root.querySelector('.map-empty');
    expect(noGps).not.toBeNull();
    expect(noGps?.textContent).toContain('Sin datos de GPS');
    document.body.removeChild(el);
  });
});