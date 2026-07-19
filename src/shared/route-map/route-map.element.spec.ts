import { describe, it, expect, vi, beforeEach } from 'vitest';

const { addSource, addLayer, fitBounds, remove, mapCtor, markerCtor } = vi.hoisted(() => {
  const addSourceFn = vi.fn();
  const addLayerFn = vi.fn();
  const fitBoundsFn = vi.fn();
  const removeFn = vi.fn();
  const onFn = vi.fn((event: string, cb: () => void) => {
    if (event === 'load') cb();
  });
  const mockMapInstance = { addSource: addSourceFn, addLayer: addLayerFn, fitBounds: fitBoundsFn, remove: removeFn, on: onFn };
  const mapCtorFn = vi.fn((_options: { center: [number, number] }) => mockMapInstance);

  const markerSetLngLat = vi.fn().mockReturnThis();
  const markerAddTo = vi.fn().mockReturnThis();
  const markerCtorFn = vi.fn(() => ({ setLngLat: markerSetLngLat, addTo: markerAddTo }));

  return {
    addSource: addSourceFn,
    addLayer: addLayerFn,
    fitBounds: fitBoundsFn,
    remove: removeFn,
    mapCtor: mapCtorFn,
    markerCtor: markerCtorFn,
  };
});

vi.mock('maplibre-gl', () => ({
  default: {
    Map: mapCtor,
    Marker: markerCtor,
  },
  Map: mapCtor,
  Marker: markerCtor,
}));

import './route-map.element.js';

type RouteMapEl = HTMLElement & { points: { lat: number; lng: number }[] };

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

async function mountRouteMap(points: { lat: number; lng: number }[]): Promise<RouteMapEl> {
  const el = document.createElement('route-map') as RouteMapEl;
  el.points = points;
  document.body.appendChild(el);
  await waitRender();
  return el;
}

describe('route-map', () => {
  beforeEach(() => {
    mapCtor.mockClear();
    markerCtor.mockClear();
    addSource.mockClear();
    addLayer.mockClear();
    fitBounds.mockClear();
    remove.mockClear();
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
});
