import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouteRepository } from '../../shared/repositories/memory-route.repository.js';
import { MemoryPhotoRepository } from '../../shared/repositories/memory-photo.repository.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import './route-detail.element.js';
import { pickFromGallery } from '../../shared/services/photo-capture-adapter.service.js';
import type * as PhotoCaptureAdapter from '../../shared/services/photo-capture-adapter.service.js';
import { ROUTE_MAP_PHOTO_SELECT_EVENT, type RouteMapPhotoSelectDetail } from '../../shared/route-map/route-map.element.js';
import type { MapPhoto } from '../../shared/route-map/route-map-photos.js';

vi.mock('../../shared/services/photo-capture-adapter.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoCaptureAdapter>();
  return { ...actual, pickFromGallery: vi.fn() };
});

// mapCtor se expone vía vi.hoisted para poder comprobar en los tests de pestañas
// (AC-008) que cambiar de pestaña no vuelve a instanciar maplibregl.Map; fitBounds/flyTo
// se exponen aparte para el test de AC-018 (abrir/cerrar el visor no toca el mapa).
const { mapCtor, mapFitBounds, mapFlyTo } = vi.hoisted(() => {
  const fitBoundsFn = vi.fn();
  const flyToFn = vi.fn();
  const mockMap = {
    remove: vi.fn(),
    fitBounds: fitBoundsFn,
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getZoom: vi.fn(() => 12),
    flyTo: flyToFn,
    // addControl (Paso 5) y setPaintProperty (Paso 3) — este mock local se
    // había quedado desactualizado respecto al mock compartido de
    // route-map.element.spec.ts, y `map.addControl(...)` (llamado siempre,
    // sin try/catch, en initMap) lanzaba una excepción no controlada al
    // faltar en este objeto (descubierto al validar la suite completa del
    // Paso 6 de mejoras-visuales-mapa).
    addControl: vi.fn(),
    setPaintProperty: vi.fn(),
    resize: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') cb();
    }),
  };
  return { mapCtor: vi.fn(() => mockMap), mapFitBounds: fitBoundsFn, mapFlyTo: flyToFn };
});

// Mock MapLibre para tests (route-map.element.ts internamente instancia el mapa)
vi.mock('maplibre-gl', () => {
  const markerFn = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }));
  const popupFn = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setDOMContent: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }));
  // NavigationControl (Paso 5) — este mock local se había quedado
  // desactualizado respecto al mock compartido de route-map.element.spec.ts;
  // sin él, `new maplibregl.NavigationControl()` en initMap lanzaba una
  // excepción no controlada (descubierto al validar la suite completa del
  // Paso 6 de mejoras-visuales-mapa).
  const navigationControlFn = vi.fn();
  return {
    default: { Map: mapCtor, Marker: markerFn, Popup: popupFn, NavigationControl: navigationControlFn },
    Map: mapCtor,
    Marker: markerFn,
    Popup: popupFn,
    NavigationControl: navigationControlFn,
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

/** La galería es un <photo-gallery> anidado con su propio shadow DOM. */
function galleryRoot(root: ShadowRoot): ShadowRoot {
  return root.querySelector('photo-gallery')!.shadowRoot!;
}

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

  it('shows a loading state synchronously while the route/points/photos fetch is in flight (AC-010)', () => {
    const el = document.createElement('route-detail') as RouteDetailEl;
    el.repository = repo;
    el.routeId = savedRoute.id;
    document.body.appendChild(el);

    // connectedCallback dispara fetchAndRender, que renderiza "loading" antes
    // de su primer await — observable sin esperar ningún microtask.
    expect(el.shadowRoot!.querySelector('[data-cy="route-detail-loading"]')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('replaces the loading state with the route content once the fetch resolves', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('[data-cy="route-detail-loading"]')).toBeNull();
    expect(root.querySelector('.detail-title')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('renders the "Añadir foto" button when a route is loaded (AC-028)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('[data-cy="detail-photo-capture"]')).not.toBeNull();
    document.body.removeChild(el);
  });

  it('shows the "Sin fotos" placeholder when the route has no photos (AC-021, AC-032)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const placeholder = galleryRoot(root).querySelector('[data-cy="photo-placeholder"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toBe('Sin fotos');
    expect(galleryRoot(root).querySelector('[data-cy="photo-gallery"]')).toBeNull();
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

describe('route-detail - nombre de ruta (AC-006, AC-007)', () => {
  it('shows the persisted name as .detail-title when the route has one (AC-006)', async () => {
    localStorage.clear();
    const repo = new MemoryRouteRepository();
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local', name: 'Puerto de la Bonaigua' },
      [],
      [],
    );

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('.detail-title')?.textContent).toBe('Puerto de la Bonaigua');
    document.body.removeChild(el);
  });

  it('falls back to the createdAt-derived title when name is null (AC-007)', async () => {
    localStorage.clear();
    const repo = new MemoryRouteRepository();
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    expect(root.querySelector('.detail-title')?.textContent).toContain('Ruta ');
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
    expect(galleryRoot(root).querySelector('[data-cy="photo-placeholder"]')).toBeNull();
    expect(galleryRoot(root).querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(1);
    document.body.removeChild(el);
  });

  it('opens the full-size viewer with a close button when a thumbnail is clicked', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const thumbnail = galleryRoot(root).querySelector('[data-cy="photo-thumbnail"]') as HTMLElement;
    thumbnail.click();

    // El visor es un <photo-viewer> montado en document.body, con su propio shadow DOM.
    const viewer = document.body.querySelector('photo-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer?.shadowRoot!.querySelector('img')?.getAttribute('src')).toBe('photo-1.jpg');
    viewer?.remove();
    document.body.removeChild(el);
  });

  it('closes the viewer when the close button is clicked', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    (galleryRoot(root).querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();
    const viewer = document.body.querySelector('photo-viewer');
    expect(viewer).not.toBeNull();

    (viewer!.shadowRoot!.querySelector('[data-cy="photo-viewer-close"]') as HTMLElement).click();
    expect(document.body.querySelector('photo-viewer')).toBeNull();
    document.body.removeChild(el);
  });

  it('shows a confirm dialog with a delete button in the viewer (AC-009)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    (galleryRoot(root).querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();

    const viewer = document.body.querySelector('photo-viewer')!;
    const deleteBtn = viewer.shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    await waitRender();

    expect(document.body.querySelector('confirm-dialog')).not.toBeNull();

    document.body.querySelector('confirm-dialog')?.remove();
    document.body.querySelector('photo-viewer')?.remove();
    document.body.removeChild(el);
  });

  it('deletes the photo, closes the viewer and refreshes the gallery when confirmed (AC-009)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    (galleryRoot(root).querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();
    const viewer = document.body.querySelector('photo-viewer')!;
    (viewer.shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement).click();
    await waitRender();

    const dialog = document.body.querySelector('confirm-dialog')!;
    (dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-confirm"]') as HTMLButtonElement).click();
    await waitRender();

    expect(document.body.querySelector('photo-viewer')).toBeNull();
    expect(galleryRoot(root).querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(0);
    expect(galleryRoot(root).querySelector('[data-cy="photo-placeholder"]')).not.toBeNull();
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Foto eliminada');
    document.body.removeChild(el);
  });

  it('keeps the photo when the deletion is cancelled', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    (galleryRoot(root).querySelector('[data-cy="photo-thumbnail"]') as HTMLElement).click();
    const viewer = document.body.querySelector('photo-viewer')!;
    (viewer.shadowRoot!.querySelector('[data-cy="photo-viewer-delete"]') as HTMLButtonElement).click();
    await waitRender();

    const dialog = document.body.querySelector('confirm-dialog')!;
    (dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-cancel"]') as HTMLButtonElement).click();
    await waitRender();

    expect(galleryRoot(root).querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(1);
    document.body.querySelector('photo-viewer')?.remove();
    document.body.removeChild(el);
  });
});

describe('route-detail - añadir varias fotos desde la galería (bug: solo se guardaba la última)', () => {
  it('persists every file selected from the gallery, not just the last one', async () => {
    localStorage.clear();
    const repo = new MemoryRouteRepository();
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [],
      [],
    );

    vi.mocked(pickFromGallery).mockResolvedValue([
      new File([''], 'a.jpg', { type: 'image/jpeg' }),
      new File([''], 'b.jpg', { type: 'image/jpeg' }),
      new File([''], 'c.jpg', { type: 'image/jpeg' }),
    ]);

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const photoCapture = root.querySelector('[data-cy="detail-photo-capture"]')!;
    (photoCapture.shadowRoot!.querySelector('.photo-btn') as HTMLButtonElement).click();
    (photoCapture.shadowRoot!.querySelector('[data-cy="photo-menu-gallery"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 200));

    expect(galleryRoot(root).querySelectorAll('[data-cy="photo-thumbnail"]')).toHaveLength(3);
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

describe('route-detail - pestañas (AC-005 a AC-008, AC-027)', () => {
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

  function tabBarRoot(root: ShadowRoot): ShadowRoot {
    return root.querySelector('tab-bar')!.shadowRoot!;
  }

  function clickTab(root: ShadowRoot, id: string): void {
    (tabBarRoot(root).querySelector(`[data-cy="tab-bar-btn-${id}"]`) as HTMLButtonElement).click();
  }

  it('mounts a tab-bar with "Fotos", "Estadísticas" y "Notas", "Fotos" activa por defecto (AC-006, AC-027)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const tabBar = root.querySelector('tab-bar');
    expect(tabBar).not.toBeNull();

    const fotosBtn = tabBarRoot(root).querySelector('[data-cy="tab-bar-btn-fotos"]');
    const statsBtn = tabBarRoot(root).querySelector('[data-cy="tab-bar-btn-estadisticas"]');
    const notasBtn = tabBarRoot(root).querySelector('[data-cy="tab-bar-btn-notas"]');
    expect(fotosBtn).not.toBeNull();
    expect(statsBtn).not.toBeNull();
    expect(notasBtn).not.toBeNull();
    expect(fotosBtn?.getAttribute('aria-selected')).toBe('true');
    expect(statsBtn?.getAttribute('aria-selected')).toBe('false');
    expect(notasBtn?.getAttribute('aria-selected')).toBe('false');
    document.body.removeChild(el);
  });

  it('shows the existing chart placeholder unchanged in "Estadísticas" (AC-007)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const chartArea = root.querySelector('.chart-area');
    expect(chartArea).not.toBeNull();
    expect(chartArea?.textContent).toBe('(próximamente)');
    document.body.removeChild(el);
  });

  it('does not refetch photos/points when switching to "Notas" and back to "Fotos" (AC-008)', async () => {
    const getPointsSpy = vi.spyOn(repo, 'getPointsByRouteId');
    const getByRouteIdSpy = vi.spyOn(MemoryPhotoRepository.prototype, 'getByRouteId');

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const pointsCallsBefore = getPointsSpy.mock.calls.length;
    const photoCallsBefore = getByRouteIdSpy.mock.calls.length;

    clickTab(root, 'notas');
    clickTab(root, 'fotos');

    expect(getPointsSpy.mock.calls.length).toBe(pointsCallsBefore);
    expect(getByRouteIdSpy.mock.calls.length).toBe(photoCallsBefore);
    document.body.removeChild(el);
  });

  it('does not reinstantiate route-map when switching tabs (AC-008)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const mapCallsBefore = mapCtor.mock.calls.length;

    clickTab(root, 'notas');
    clickTab(root, 'fotos');

    expect(mapCtor.mock.calls.length).toBe(mapCallsBefore);
    document.body.removeChild(el);
  });
});

describe('route-detail - integración mapa → visor de fotos (AC-014 a AC-018, AC-029)', () => {
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
    // Dos fotos geolocalizadas, para poder comprobar un startIndex != 0 (AC-015, AC-029).
    localStorage.setItem('moto-routes-photos', JSON.stringify([
      {
        id: 'photo-1', routeId: savedRoute.id, filePath: 'photo-1.jpg',
        latitude: 40.4168, longitude: -3.7038,
        capturedAt: '2026-07-20T10:00:00.000Z', createdAt: '2026-07-20T10:00:00.000Z',
      },
      {
        id: 'photo-2', routeId: savedRoute.id, filePath: 'photo-2.jpg',
        latitude: 40.4170, longitude: -3.7035,
        capturedAt: '2026-07-20T10:05:00.000Z', createdAt: '2026-07-20T10:05:00.000Z',
      },
    ]));
  });

  function getRouteMap(root: ShadowRoot): HTMLElement & { photos: MapPhoto[] } {
    return root.querySelector('route-map') as HTMLElement & { photos: MapPhoto[] };
  }

  function dispatchPhotoSelect(routeMap: HTMLElement, photo: MapPhoto): void {
    routeMap.dispatchEvent(new CustomEvent<RouteMapPhotoSelectDetail>(ROUTE_MAP_PHOTO_SELECT_EVENT, {
      detail: { photo },
      bubbles: true,
      composed: true,
    }));
  }

  it('passes the full list of photos with objectUrl already resolved to <route-map> (AC-016, verificación sin cambio de código)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const routeMap = getRouteMap(root);

    expect(routeMap.photos).toHaveLength(2);
    expect(routeMap.photos.map((p) => p.id).sort()).toEqual(['photo-1', 'photo-2']);
    expect(routeMap.photos.every((p) => typeof p.objectUrl === 'string' && p.objectUrl.length > 0)).toBe(true);

    document.body.removeChild(el);
  });

  it('opens photo-viewer at the matching index when route-map dispatches route-map:photo-select (AC-015, AC-029)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const routeMap = getRouteMap(root);
    const secondPhoto = routeMap.photos[1]!;

    dispatchPhotoSelect(routeMap, secondPhoto);

    const viewer = document.body.querySelector('photo-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer?.shadowRoot!.querySelector('img')?.getAttribute('src')).toBe(secondPhoto.objectUrl);
    expect(viewer?.shadowRoot!.querySelector('.counter')?.textContent).toBe('2 de 2');

    viewer?.remove();
    document.body.removeChild(el);
  });

  it('does not change the map state (no extra flyTo/fitBounds calls) after opening and closing the viewer from the popup event (AC-018)', async () => {
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    const routeMap = getRouteMap(root);
    const photo = routeMap.photos[0]!;

    const fitBoundsCallsBefore = mapFitBounds.mock.calls.length;
    const flyToCallsBefore = mapFlyTo.mock.calls.length;

    dispatchPhotoSelect(routeMap, photo);

    const viewer = document.body.querySelector('photo-viewer')!;
    (viewer.shadowRoot!.querySelector('[data-cy="photo-viewer-close"]') as HTMLButtonElement).click();
    expect(document.body.querySelector('photo-viewer')).toBeNull();

    expect(mapFitBounds.mock.calls.length).toBe(fitBoundsCallsBefore);
    expect(mapFlyTo.mock.calls.length).toBe(flyToCallsBefore);

    document.body.removeChild(el);
  });
});

describe('route-detail - editor de notas (AC-010 a AC-017)', () => {
  let repo: IRouteRepository;

  function notasRoot(root: ShadowRoot): ShadowRoot {
    return root.querySelector('tab-bar')!.shadowRoot!;
  }

  function clickTab(root: ShadowRoot, id: string): void {
    (notasRoot(root).querySelector(`[data-cy="tab-bar-btn-${id}"]`) as HTMLButtonElement).click();
  }

  function notesTextarea(root: ShadowRoot): HTMLTextAreaElement {
    return root.querySelector('[data-cy="route-detail-textarea-notas"]') as HTMLTextAreaElement;
  }

  function saveNoteBtn(root: ShadowRoot): HTMLButtonElement {
    return root.querySelector('[data-cy="route-detail-btn-guardar-nota"]') as HTMLButtonElement;
  }

  function editNoteBtn(root: ShadowRoot): HTMLButtonElement {
    return root.querySelector('[data-cy="route-detail-btn-editar-nota"]') as HTMLButtonElement;
  }

  function noteViewText(root: ShadowRoot): HTMLElement {
    return root.querySelector('[data-cy="route-detail-texto-nota"]') as HTMLElement;
  }

  beforeEach(() => {
    localStorage.clear();
    repo = new MemoryRouteRepository();
    // Toasts anteriores (de otros describe de este mismo archivo) se autodestruyen
    // pasado su plazo real, pero los tests no esperan tanto — se limpian explícitamente
    // para que `document.body.querySelector('[data-cy="photo-toast"]')` no encuentre
    // un toast obsoleto de un test anterior en vez del que dispara este test.
    document.body.querySelectorAll('.photo-toast').forEach((el) => { el.remove(); });
  });

  it('shows an empty textarea with the expected placeholder when the route has no notes (AC-014)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');

    const textarea = notesTextarea(root);
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('');
    expect(textarea.placeholder).toBe('Escribe aquí tus notas sobre la ruta…');
    document.body.removeChild(el);
  });

  it('loads and shows the existing note in view mode without any user action (AC-013, AC-019)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    await repo.updateNotes(savedRoute.id, 'Buen firme, gasolinera en el km 40');

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');

    expect(noteViewText(root).textContent).toBe('Buen firme, gasolinera en el km 40');
    expect(notesTextarea(root)).toBeNull();
    expect(editNoteBtn(root)).not.toBeNull();
    document.body.removeChild(el);
  });

  it('switches to the editable textarea, prefilled with the current text, when the edit icon is clicked (AC-019)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    await repo.updateNotes(savedRoute.id, 'Buen firme, gasolinera en el km 40');

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');
    editNoteBtn(root).click();

    expect(notesTextarea(root).value).toBe('Buen firme, gasolinera en el km 40');
    expect(noteViewText(root)).toBeNull();
    document.body.removeChild(el);
  });

  it('persists the typed text via updateNotes and shows a success toast when "Guardar nota" is clicked (AC-010, AC-011, AC-012)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');

    notesTextarea(root).value = 'Curva peligrosa en el km 12';
    saveNoteBtn(root).click();
    await waitRender();

    const persisted = await repo.getById(savedRoute.id);
    expect(persisted!.notes).toBe('Curva peligrosa en el km 12');
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Nota guardada');
    document.body.removeChild(el);
  });

  it('updates the persisted value when editing an existing note, and returns to view mode with the updated text (AC-013 edición, AC-019)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    await repo.updateNotes(savedRoute.id, 'Texto original');

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');
    editNoteBtn(root).click();

    notesTextarea(root).value = 'Texto actualizado';
    saveNoteBtn(root).click();
    await waitRender();

    const persisted = await repo.getById(savedRoute.id);
    expect(persisted!.notes).toBe('Texto actualizado');
    expect(noteViewText(root).textContent).toBe('Texto actualizado');
    expect(notesTextarea(root)).toBeNull();
    document.body.removeChild(el);
  });

  it('persists notes as null (without any confirmation dialog) when all content is deleted and saved, staying in the editable textarea since there is nothing left to view (AC-016, AC-019)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    await repo.updateNotes(savedRoute.id, 'Texto a borrar');

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');
    editNoteBtn(root).click();

    notesTextarea(root).value = '';
    saveNoteBtn(root).click();
    await waitRender();

    expect(document.body.querySelector('confirm-dialog')).toBeNull();
    const persisted = await repo.getById(savedRoute.id);
    expect(persisted!.notes).toBeNull();
    expect(document.body.querySelector('[data-cy="photo-toast"]')?.textContent).toBe('Nota guardada');
    expect(notesTextarea(root).value).toBe('');
    expect(noteViewText(root)).toBeNull();
    document.body.removeChild(el);
  });

  it('shows an error toast and keeps the typed text in the textarea when updateNotes rejects (AC-017)', async () => {
    const savedRoute = await repo.save(
      { duration: 300, totalDistance: 46.2, avgSpeed: 55, status: 'completed', visibility: 'private', origin: 'local' },
      [], [],
    );
    vi.spyOn(repo, 'updateNotes').mockRejectedValueOnce(new Error('fallo de BBDD'));

    const { el, root } = await mountRouteDetail(repo, savedRoute.id);
    clickTab(root, 'notas');

    notesTextarea(root).value = 'Texto que no debe perderse';
    saveNoteBtn(root).click();
    await waitRender();

    expect(document.body.querySelector('[data-cy="photo-toast-error"]')?.textContent).toBe('⚠️ fallo de BBDD');
    expect(notesTextarea(root).value).toBe('Texto que no debe perderse');
    document.body.removeChild(el);
  });
});