import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  addSource, addLayer, fitBounds, remove, mapCtor, markerCtor, markerRemove, popupCtor, mapOn, getZoom, flyTo,
  setPaintProperty,
} = vi.hoisted(() => {
  const addSourceFn = vi.fn();
  const addLayerFn = vi.fn();
  const fitBoundsFn = vi.fn();
  const removeFn = vi.fn();
  const getZoomFn = vi.fn(() => 12);
  const flyToFn = vi.fn();
  const setPaintPropertyFn = vi.fn();
  // Solo registra el callback — no lo invoca. Antes este mock invocaba `load`
  // de forma síncrona e incondicional al registrarlo, lo que hacía imposible
  // testear ningún estado "antes de load" (p. ej. el skeleton de carga,
  // AC-005/AC-006/AC-023). Ahora el disparo es explícito vía `triggerLoad()`,
  // igual que ya existe `triggerZoomEnd()` para 'zoomend'.
  const onFn = vi.fn();
  const mockMapInstance = {
    addSource: addSourceFn,
    addLayer: addLayerFn,
    fitBounds: fitBoundsFn,
    remove: removeFn,
    on: onFn,
    getZoom: getZoomFn,
    flyTo: flyToFn,
    setPaintProperty: setPaintPropertyFn,
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
    flyTo: flyToFn,
    setPaintProperty: setPaintPropertyFn,
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
import { ROUTE_MAP_PHOTO_SELECT_EVENT, type RouteMapPhotoSelectDetail } from './route-map.element.js';
import type { MapPhoto } from './route-map-photos.js';
import { ROAD_LAYER_IDS } from './route-map-contrast.js';

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

/**
 * Monta `<route-map>` sin disparar el evento `load` del mock de MapLibre —
 * deja al componente en el estado "cargando" (skeleton visible). Solo para
 * el test del skeleton (AC-005, AC-006, AC-007, AC-023); el resto de tests
 * sigue usando `mountRouteMap()`, que dispara `load` automáticamente.
 */
async function mountRouteMapWithoutLoad(points: { lat: number; lng: number }[]): Promise<RouteMapEl> {
  const el = document.createElement('route-map') as RouteMapEl;
  el.points = points;
  document.body.appendChild(el);
  await waitRender();
  return el;
}

async function mountRouteMap(points: { lat: number; lng: number }[]): Promise<RouteMapEl> {
  const el = await mountRouteMapWithoutLoad(points);
  triggerLoad();
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

function triggerLoad(): void {
  const loadCall = mapOn.mock.calls.find(([event]) => event === 'load');
  (loadCall?.[1] as (() => void) | undefined)?.();
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
    flyTo.mockClear();
    setPaintProperty.mockReset();
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
      triggerLoad();

      expect(findMarkerElements('photo-marker')).toHaveLength(1);

      document.body.removeChild(el);
    });

    it('dispatches route-map:photo-select directly when a photo marker is clicked, without an intermediate popup (AC-015, AC-029)', async () => {
      const el = await mountRouteMap(MADRID_POINTS);
      const photo = makePhoto('p1', 40.4168, -3.7038, 'blob:thumb-1');
      el.photos = [photo];
      await waitRender();

      const [marker] = findMarkerElements('photo-marker');
      const handler = vi.fn();
      el.addEventListener(ROUTE_MAP_PHOTO_SELECT_EVENT, ((e: CustomEvent<RouteMapPhotoSelectDetail>) => {
        handler(e.detail);
      }) as EventListener);

      marker!.click();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]?.[0]).toEqual({ photo });
      expect(document.body.querySelector('[data-cy="route-map-photo-popup"]')).toBeNull();

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

    it('still calls map.flyTo and does not dispatch route-map:photo-select when a cluster marker is clicked (regression AC-017)', async () => {
      const el = await mountRouteMap(MADRID_POINTS);
      el.photos = [
        makePhoto('p1', 40.4168, -3.7038, 'blob:thumb-1'),
        makePhoto('p2', 40.41693, -3.7038, 'blob:thumb-2'),
      ];
      await waitRender();
      expect(findMarkerElements('photo-cluster')).toHaveLength(1);

      const handler = vi.fn();
      el.addEventListener(ROUTE_MAP_PHOTO_SELECT_EVENT, handler);

      const [cluster] = findMarkerElements('photo-cluster');
      cluster!.click();

      expect(flyTo).toHaveBeenCalledOnce();
      expect(handler).not.toHaveBeenCalled();

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

  describe('atribución OpenFreeMap/OSM (AC-008, AC-009, AC-024)', () => {
    it('constructs the map with a real (compact) attribution control instead of false', async () => {
      const el = await mountRouteMap(MADRID_POINTS);

      const options = mapCtor.mock.calls[0]?.[0] as { attributionControl?: unknown };
      expect(options.attributionControl).not.toBe(false);
      expect(options.attributionControl).toEqual({ compact: true });

      document.body.removeChild(el);
    });
  });

  describe('skeleton de carga (AC-005, AC-006, AC-007, AC-023)', () => {
    it('shows the loading skeleton while load has not fired yet, and hides it once load fires', async () => {
      const el = await mountRouteMapWithoutLoad(MADRID_POINTS);

      const root = el.shadowRoot!;
      expect(root.querySelector('[data-cy="route-map-skeleton"]')).not.toBeNull();

      triggerLoad();
      await waitRender();

      expect(root.querySelector('[data-cy="route-map-skeleton"]')).toBeNull();

      document.body.removeChild(el);
    });
  });

  describe('marcadores de inicio/fin (AC-010, AC-011, AC-012, AC-025)', () => {
    function findStartEndMarkerElements(): { start: HTMLElement | undefined; end: HTMLElement | undefined } {
      const elements = markerCtor.mock.calls.map(([options]) => options.element);
      return {
        start: elements.find((element) => element.classList.contains('route-map-marker--start')),
        end: elements.find((element) => element.classList.contains('route-map-marker--end')),
      };
    }

    it('start and end markers use the new pin-icon markup instead of a plain circle', async () => {
      const el = await mountRouteMap(MADRID_POINTS);

      const { start, end } = findStartEndMarkerElements();

      expect(start).toBeDefined();
      expect(end).toBeDefined();
      expect(start!.classList.contains('route-map-marker--pin')).toBe(true);
      expect(end!.classList.contains('route-map-marker--pin')).toBe(true);
      expect(start!.querySelector('svg')).not.toBeNull();
      expect(end!.querySelector('svg')).not.toBeNull();

      document.body.removeChild(el);
    });

    it('keeps exactly 2 start/end markers and their route-map-marker--start/--end classes after the pin-icon change (regression)', async () => {
      const el = await mountRouteMap(MADRID_POINTS);

      expect(markerCtor).toHaveBeenCalledTimes(2);
      const { start, end } = findStartEndMarkerElements();
      expect(start).toBeDefined();
      expect(end).toBeDefined();

      document.body.removeChild(el);
    });
  });

  describe('contraste visual de capas de carretera (AC-001, AC-002, AC-003, AC-004, AC-022)', () => {
    it('calls setPaintProperty for at least one road layer after load, with a color different from a placeholder/blue tone', async () => {
      const el = await mountRouteMap(MADRID_POINTS);

      expect(setPaintProperty.mock.calls.length).toBeGreaterThan(0);
      for (const [layerId, property, value] of setPaintProperty.mock.calls) {
        expect(ROAD_LAYER_IDS).toContain(layerId);
        expect(property).toBe('line-color');
        expect(String(value)).not.toMatch(/blue|azure|#0000ff/i);
      }

      document.body.removeChild(el);
    });

    it('does not throw and still draws the route, markers and fitBounds when setPaintProperty throws for a given layer id', async () => {
      setPaintProperty.mockImplementation(() => {
        throw new Error('layer not found in style');
      });

      const el = await mountRouteMap(MADRID_POINTS);

      expect(addSource).toHaveBeenCalled();
      expect(addLayer).toHaveBeenCalled();
      expect(fitBounds).toHaveBeenCalled();
      expect(markerCtor).toHaveBeenCalledTimes(2);

      document.body.removeChild(el);
    });
  });
});
