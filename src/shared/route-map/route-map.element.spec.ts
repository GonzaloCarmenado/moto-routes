import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  addSource, addLayer, fitBounds, remove, mapCtor, markerCtor, markerRemove, popupCtor, mapOn, getZoom,
} = vi.hoisted(() => {
  const addSourceFn = vi.fn();
  const addLayerFn = vi.fn();
  const fitBoundsFn = vi.fn();
  const removeFn = vi.fn();
  const getZoomFn = vi.fn(() => 12);
  const onFn = vi.fn((event: string, cb: () => void) => {
    if (event === 'load') cb();
  });
  const mockMapInstance = {
    addSource: addSourceFn,
    addLayer: addLayerFn,
    fitBounds: fitBoundsFn,
    remove: removeFn,
    on: onFn,
    getZoom: getZoomFn,
    flyTo: vi.fn(),
  };
  const mapCtorFn = vi.fn((_options: { center: [number, number] }) => mockMapInstance);

  const markerSetLngLat = vi.fn().mockReturnThis();
  const markerAddTo = vi.fn().mockReturnThis();
  // Compartido entre todos los markers, para poder contar borrados totales en los tests;
  // además quita el data-cy del elemento borrado, así los tests pueden distinguir los
  // markers "vivos" de los que ya se quitaron del mapa (el historial de mock.calls de
  // Marker conserva TODOS los elementos creados, también los ya eliminados).
  const markerRemoveFn = vi.fn((element: HTMLElement) => { element.removeAttribute('data-cy'); });
  const markerCtorFn = vi.fn((options: { element: HTMLElement }) => ({
    element: options.element,
    setLngLat: markerSetLngLat,
    addTo: markerAddTo,
    remove: (): void => { markerRemoveFn(options.element); },
  }));

  class MockPopup {
    private content: HTMLElement | null = null;
    setLngLat(): this { return this; }
    setDOMContent(content: HTMLElement): this {
      this.content = content;
      return this;
    }
    addTo(): this {
      if (this.content) document.body.appendChild(this.content);
      return this;
    }
    remove(): void {
      this.content?.remove();
    }
  }
  const popupCtorFn = vi.fn(() => new MockPopup());

  return {
    addSource: addSourceFn,
    addLayer: addLayerFn,
    fitBounds: fitBoundsFn,
    remove: removeFn,
    mapCtor: mapCtorFn,
    markerCtor: markerCtorFn,
    markerRemove: markerRemoveFn,
    popupCtor: popupCtorFn,
    mapOn: onFn,
    getZoom: getZoomFn,
  };
});

vi.mock('maplibre-gl', () => ({
  default: {
    Map: mapCtor,
    Marker: markerCtor,
    Popup: popupCtor,
  },
  Map: mapCtor,
  Marker: markerCtor,
  Popup: popupCtor,
}));

import './route-map.element.js';
import type { MapPhoto } from './route-map-photos.js';

type RouteMapEl = HTMLElement & { points: { lat: number; lng: number }[]; photos: MapPhoto[] };

async function waitRender(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => { resolve(); }));
  await new Promise((r) => setTimeout(r, 0));
}

const MADRID_POINTS = [
  { lat: 40.4168, lng: -3.7038 },
  { lat: 40.4170, lng: -3.7035 },
];
const BARCELONA_POINTS = [
  { lat: 41.3874, lng: 2.1686 },
  { lat: 41.3880, lng: 2.1690 },
];

function makePhoto(id: string, lat: number, lng: number, objectUrl?: string): MapPhoto {
  return {
    id,
    routeId: 'route-1',
    filePath: `photos/${id}.jpg`,
    latitude: lat,
    longitude: lng,
    capturedAt: '2026-07-20T10:00:00.000Z',
    createdAt: '2026-07-20T10:00:00.000Z',
    ...(objectUrl !== undefined ? { objectUrl } : {}),
  };
}

async function mountRouteMap(points: { lat: number; lng: number }[]): Promise<RouteMapEl> {
  const el = document.createElement('route-map') as RouteMapEl;
  el.points = points;
  document.body.appendChild(el);
  await waitRender();
  return el;
}

function findMarkerElements(dataCy: string): HTMLElement[] {
  return markerCtor.mock.calls
    .map(([options]) => options.element)
    .filter((element) => element.getAttribute('data-cy') === dataCy);
}

function triggerZoomEnd(): void {
  const zoomendCall = mapOn.mock.calls.find(([event]) => event === 'zoomend');
  (zoomendCall?.[1] as (() => void) | undefined)?.();
}

describe('route-map', () => {
  beforeEach(() => {
    mapCtor.mockClear();
    markerCtor.mockClear();
    markerRemove.mockClear();
    popupCtor.mockClear();
    addSource.mockClear();
    addLayer.mockClear();
    fitBounds.mockClear();
    remove.mockClear();
    mapOn.mockClear();
    getZoom.mockReturnValue(12);
    document.body.querySelectorAll('.route-map-photo-popup').forEach((el) => { el.remove(); });
  });

  it('should initialize the map and add the route source when points are provided', async () => {
    const el = await mountRouteMap(MADRID_POINTS);

    expect(mapCtor).toHaveBeenCalledOnce();
    expect(addSource).toHaveBeenCalled();
    expect(addLayer).toHaveBeenCalled();
    expect(fitBounds).toHaveBeenCalled();
    expect(markerCtor).toHaveBeenCalledTimes(2);

    document.body.removeChild(el);
  });

  it('should show "Sin datos de GPS" and not instantiate the map when there are no points', async () => {
    const el = await mountRouteMap([]);

    const root = el.shadowRoot!;
    const empty = root.querySelector('.map-empty');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('Sin datos de GPS');
    expect(mapCtor).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('should destroy the map instance when disconnected from the DOM', async () => {
    const el = await mountRouteMap(MADRID_POINTS);

    document.body.removeChild(el);

    expect(remove).toHaveBeenCalledOnce();
  });

  it('should destroy the previous map instance and rebuild it when points are reassigned while already mounted', async () => {
    const el = await mountRouteMap(MADRID_POINTS);

    expect(mapCtor).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();

    el.points = BARCELONA_POINTS;
    await waitRender();

    expect(remove).toHaveBeenCalledOnce();
    expect(mapCtor).toHaveBeenCalledTimes(2);
    expect(mapCtor.mock.calls[1]?.[0].center).toEqual([2.1686, 41.3874]);

    document.body.removeChild(el);
  });

  describe('marcadores de fotos (AC-014, AC-015, AC-018)', () => {
    it('renders a photo marker once the map has loaded, even when photos were set before connecting', async () => {
      const el = document.createElement('route-map') as RouteMapEl;
      el.points = MADRID_POINTS;
      el.photos = [makePhoto('p1', 40.4168, -3.7038)];
      document.body.appendChild(el);
      await waitRender();

      expect(findMarkerElements('photo-marker')).toHaveLength(1);

      document.body.removeChild(el);
    });

    it('shows a popup with the photo thumbnail when a photo marker is clicked (AC-015)', async () => {
      const el = await mountRouteMap(MADRID_POINTS);
      el.photos = [makePhoto('p1', 40.4168, -3.7038, 'blob:thumb-1')];
      await waitRender();

      const [marker] = findMarkerElements('photo-marker');
      marker!.click();

      const popup = document.body.querySelector('[data-cy="route-map-photo-popup"]');
      expect(popup).not.toBeNull();
      expect(popup!.querySelector('img')?.getAttribute('src')).toBe('blob:thumb-1');

      document.body.removeChild(el);
    });

    it('groups two nearby photos into a single cluster when zoomed out', async () => {
      const el = await mountRouteMap(MADRID_POINTS);
      // ~15m apart — well within the clustering radius at zoom 12.
      el.photos = [
        makePhoto('p1', 40.4168, -3.7038),
        makePhoto('p2', 40.41693, -3.7038),
      ];
      await waitRender();

      expect(findMarkerElements('photo-cluster')).toHaveLength(1);
      expect(findMarkerElements('photo-marker')).toHaveLength(0);

      document.body.removeChild(el);
    });

    it('splits a cluster into individual markers when zooming in (AC-018)', async () => {
      const el = await mountRouteMap(MADRID_POINTS);
      el.photos = [
        makePhoto('p1', 40.4168, -3.7038),
        makePhoto('p2', 40.41693, -3.7038),
      ];
      await waitRender();
      expect(findMarkerElements('photo-cluster')).toHaveLength(1);

      const previousMarkerRemovals = markerRemove.mock.calls.length;
      getZoom.mockReturnValue(19);
      triggerZoomEnd();
      await waitRender();

      expect(markerRemove.mock.calls.length).toBeGreaterThan(previousMarkerRemovals);
      expect(findMarkerElements('photo-cluster')).toHaveLength(0);
      expect(findMarkerElements('photo-marker')).toHaveLength(2);

      document.body.removeChild(el);
    });
  });
});
