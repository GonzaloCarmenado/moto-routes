import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StopCategory } from '../stop-types/stop-types.types.js';
import type { MapStop } from './route-map-stops.js';

// Mismo motivo que route-map-photos.spec.ts: maplibre-gl toca window.URL.createObjectURL
// al importarse, no disponible en jsdom por defecto — se mockea el constructor Marker
// para poder testear addStopMarkers en aislamiento.
const { markerCtor } = vi.hoisted(() => {
  const markerSetLngLat = vi.fn().mockReturnThis();
  const markerAddTo = vi.fn().mockReturnThis();
  const markerCtorFn = vi.fn((options: { element: HTMLElement; anchor?: string }) => ({
    element: options.element,
    setLngLat: markerSetLngLat,
    addTo: markerAddTo,
    remove: vi.fn(),
  }));
  return { markerCtor: markerCtorFn };
});

vi.mock('maplibre-gl', () => ({ default: { Marker: markerCtor }, Marker: markerCtor }));

const { addStopMarkers } = await import('./route-map-stops.js');

const MIRADOR: StopCategory = { id: 1, key: 'mirador', label: 'Mirador', icon: '🌄' };
const BAR: StopCategory = { id: 2, key: 'bar-restaurante', label: 'Bar/Restaurante', icon: '🍺' };

const fakeMap = {} as Parameters<typeof addStopMarkers>[0];

describe('addStopMarkers (AC-7.1 a AC-7.3)', () => {
  beforeEach(() => {
    markerCtor.mockClear();
  });

  it('AC-7.1: crea un marcador por parada con categoría resuelta, mostrando el icono del catálogo', () => {
    const stops: MapStop[] = [{ lat: 40.4, lng: -3.7, stopCategoryId: 1 }];
    const markers = addStopMarkers(fakeMap, stops, new Map([[1, MIRADOR]]));

    expect(markers).toHaveLength(1);
    const [options] = markerCtor.mock.calls[0]!;
    const icon = options.element.querySelector('.route-map-marker--stop');
    expect(icon?.querySelector('svg')).not.toBeNull();
    expect(icon?.textContent).not.toContain('🌄');
  });

  it('AC-7.2: paradas de distinto tipo muestran iconos SVG distintos', () => {
    const stops: MapStop[] = [
      { lat: 40.4, lng: -3.7, stopCategoryId: 1 },
      { lat: 40.41, lng: -3.71, stopCategoryId: 2 },
    ];
    addStopMarkers(fakeMap, stops, new Map([[1, MIRADOR], [2, BAR]]));

    const icons = markerCtor.mock.calls.map(
      ([options]) => options.element.querySelector('.route-map-marker--stop')!.innerHTML,
    );
    expect(icons[0]).not.toBe(icons[1]);
  });

  it('AC-7.3: una parada sin categoría asignada (stopCategoryId null) no genera marcador', () => {
    const stops: MapStop[] = [{ lat: 40.4, lng: -3.7, stopCategoryId: null }];
    const markers = addStopMarkers(fakeMap, stops, new Map([[1, MIRADOR]]));
    expect(markers).toHaveLength(0);
  });

  it('AC-7.3: una parada cuyo id no está en el catálogo resuelto no genera marcador', () => {
    const stops: MapStop[] = [{ lat: 40.4, lng: -3.7, stopCategoryId: 99 }];
    const markers = addStopMarkers(fakeMap, stops, new Map([[1, MIRADOR]]));
    expect(markers).toHaveLength(0);
  });

  it('AC-7.3: una ruta sin paradas no genera ningún marcador', () => {
    const markers = addStopMarkers(fakeMap, [], new Map());
    expect(markers).toHaveLength(0);
  });

  it('marca el elemento con data-cy="route-map-stop-marker" y el título con la etiqueta de la categoría', () => {
    const stops: MapStop[] = [{ lat: 40.4, lng: -3.7, stopCategoryId: 1 }];
    addStopMarkers(fakeMap, stops, new Map([[1, MIRADOR]]));

    const [options] = markerCtor.mock.calls[0]!;
    const hitArea = options.element;
    expect(hitArea.getAttribute('data-cy')).toBe('route-map-stop-marker');
    expect(hitArea.title).toBe('Mirador');
  });
});
