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
  // 50ms (no 0ms): fetchAndRender() encadena varias promesas reales (repo.getById,
  // getPointsByRouteId, photoRepo.getByRouteId, getPhotoUrl por foto) antes de
  // llamar a render() — bajo carga (suite completa + cobertura v8) 0ms resultaba
  // intermitente, igual que en cockpit.element.spec.ts.
  await new Promise((r) => setTimeout(r, 50));
}

type RouteDetailEl = HTMLElement & { repository: IRouteRepository; routeId: string };

async function mountRouteDetail(repo: IRouteRepository, routeId: string): Promise<{ el: RouteDetailEl; root: ShadowRoot }> {
  const el = document.createElement('route-detail') as RouteDetailEl;
  el.repository = repo;
  el.routeId = routeId;
  document.body.appendChild(el);
  await waitRender();
  return { el, root: el.shadowRoot! };
}

describe('route-detail - contenido básico', () => {
  let repo: IRouteRepository;
  let savedRoute: Route;

  beforeEach(async () => {
    localStorage.clear();
    repo = new MemoryRouteRepository();
    savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
  });

  it('renders the "Añadir foto" button when a route is loaded (AC-028)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('[data-cy="detail-photo-capture"]')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('shows the "Sin fotos" placeholder when the route has no photos (AC-021, AC-032)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const placeholder = root.querySelector('[data-cy="photo-placeholder"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toBe('Sin fotos');
    expect(root.querySelector('[data-cy="photo-gallery"]')).toBeNull();
    document.body.removeChild(el);
  });

  it('should show empty message when route does not exist', async () => {
    const { el, root } = await mountRouteDetail(repo, 'non-existent-id');
    const empty = root.querySelector('.empty-msg');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('Ruta no encontrada');
    document.body.removeChild(el);
  });

  it('should show route details when route exists', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('.detail-title')).not.toBeNull();
    expect(root.querySelector('.detail-date')).not.toBeNull();
    expect(root.querySelectorAll('.stat-tile').length).toBe(4);
    document.body.removeChild(el);
  });

  it('should emit back-to-list event when back button is clicked', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const backBtn = root.querySelector('.back-btn') as HTMLButtonElement;

    const handler = vi.fn();
    window.addEventListener('back-to-list', handler);
    backBtn?.click();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('back-to-list', handler);
    document.body.removeChild(el);
  });
});

describe('route-detail - galería y visor de fotos (AC-019, AC-020, AC-033)', () => {
  let repo: IRouteRepository;
  let savedRoute: Route;

  beforeEach(async () => {
    localStorage.clear();
    repo = new MemoryRouteRepository();
    savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );
    // Seed directo del storage de MemoryPhotoRepository (misma forma que usa en runtime)
    // para no depender del flujo completo de captura (input file + FileReader) en este test.
    localStorage.setItem('moto-routes-photos', JSON.stringify([
      {
        id: 'photo-1', routeId: savedRoute.id, filePath: 'photo-1.jpg',
        latitude: 40.4168, longitude: -3.7038,
        capturedAt: '2026-07-20T10:00:00.000Z', createdAt: '2026-07-20T10:00:00.000Z',
      },
    ]));
  });

  it('renders a thumbnail for the existing photo instead of the placeholder', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('[data-cy="photo-placeholder"]')).toBeNull();
    expect(root.querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(1);
    document.body.removeChild(el);
  });

  it('opens the full-size viewer with a close button when a thumbnail is clicked', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const thumbnail = root.querySelector('[data-cy="photo-thumbnail"]') as HTMLElement;
    thumbnail.click();

    // El visor se monta como overlay en document.body, no dentro del shadow DOM del componente.
    const viewer = document.body.querySelector('[data-cy="photo-viewer"]');
    expect(viewer).not.toBeNull();
    expect(viewer?.querySelector('img')?.getAttribute('src')).toBe('photo-1.jpg');
    viewer?.remove();
    document.body.removeChild(el);
  });

  it('closes the viewer when the close button is clicked', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    (root.querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();
    expect(document.body.querySelector('[data-cy="photo-viewer"]')).not.toBeNull();

    (document.body.querySelector('[data-cy="photo-viewer-close"]') as HTMLElement).click();
    expect(document.body.querySelector('[data-cy="photo-viewer"]')).toBeNull();
    document.body.removeChild(el);
  });
});

describe('route-detail - integración con route-map', () => {
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

    const { el, root } = await mountRouteDetail(repo, pointRoute.id);
    const routeMap = root.querySelector<HTMLElement & { points: { lat: number; lng: number }[] }>('route-map');
    expect(routeMap).not.toBeNull();
    expect(routeMap?.points).toEqual([
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4170, lng: -3.7035 },
    ]);
    document.body.removeChild(el);
  });

  it('should render a route-map element with an empty points array when the route has no GPS points', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const routeMap = root.querySelector<HTMLElement & { points: { lat: number; lng: number }[] }>('route-map');
    expect(routeMap).not.toBeNull();
    expect(routeMap?.points).toEqual([]);
    document.body.removeChild(el);
  });
});