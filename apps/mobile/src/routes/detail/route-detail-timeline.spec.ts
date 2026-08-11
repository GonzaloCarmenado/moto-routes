import { describe, it, expect, vi } from 'vitest';
import { buildTimelinePanel } from './route-detail-timeline.js';
import type { RoutePoint } from '../../shared/models/route.types.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';
import type { TimelinePhotoInput, TimelineStopInput } from './route-timeline.types.js';

function makePt(overrides: Partial<RoutePoint> & { timestamp: number; speed: number }): RoutePoint {
  return {
    id: 'p1',
    routeId: 'r1',
    lat: 40.4168,
    lng: -3.7038,
    alt: 100,
    ...overrides,
  };
}

/** Atajo para `buildTimelinePanel` con valores por defecto — reduce boilerplate en los tests que no ejercitan paradas/categorías. */
function panel(
  points: RoutePoint[],
  photos: TimelinePhotoInput[],
  onPhotoClick: (photoId: string) => void,
  stopData: { stops: TimelineStopInput[]; categoriesById: Map<number, StopCategory> } = { stops: [], categoriesById: new Map<number, StopCategory>() },
): HTMLElement {
  return buildTimelinePanel({ points, photos, ...stopData }, onPhotoClick);
}

const MIRADOR: StopCategory = { id: 1, key: 'mirador', label: 'Mirador', icon: '🌄' };

describe('buildTimelinePanel (AC-009, AC-018)', () => {
  it('AC-018: Salida lleva data-cy correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = panel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-salida"]')).not.toBeNull();
  });

  it('AC-018: Llegada lleva data-cy correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = panel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-llegada"]')).not.toBeNull();
  });

  it('AC-018: foto lleva data-cy con su photoId', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const photos = [{ id: 'foto-1', capturedAt: new Date(1500).toISOString() }];
    const el = panel(points, photos, vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-foto-foto-1"]')).not.toBeNull();
  });

  it('AC-018: tramo lleva data-cy con su índice', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = panel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-tramo-0"]')).not.toBeNull();
  });

  it('AC-009: pulsar un evento foto invoca onPhotoClick con el photoId correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const photos = [{ id: 'foto-1', capturedAt: new Date(1500).toISOString() }];
    const onClick = vi.fn();
    const el = panel(points, photos, onClick);

    const btn = el.querySelector('[data-cy="route-detail-timeline-evento-foto-foto-1"]') as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onClick).toHaveBeenCalledWith('foto-1');
  });

  it('AC-017: sin GPS ni fotos muestra mensaje vacío', () => {
    const el = panel([], [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-vacio"]')).not.toBeNull();
    // No debe haber eventos
    expect(el.querySelector('[data-cy^="route-detail-timeline-evento"]')).toBeNull();
  });

  it('AC-016: sin GPS suficiente pero con fotos muestra las fotos y el mensaje', () => {
    const photos = [{ id: 'foto-1', capturedAt: new Date(1000).toISOString() }];
    const el = panel([], photos, vi.fn());
    // Mensaje vacío presente
    expect(el.querySelector('[data-cy="route-detail-timeline-vacio"]')).not.toBeNull();
    // Foto presente
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-foto-foto-1"]')).not.toBeNull();
  });

  it('AC-015: con GPS no muestra el mensaje vacío', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = panel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-vacio"]')).toBeNull();
  });

  it('AC-6.1/6.3: una parada real con categoría resuelta aparece con el icono y la etiqueta de su tipo', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 1500, speed: 0 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const stops: TimelineStopInput[] = [{ startTime: 1500, lat: 40.42, lng: -3.71, stopCategoryId: 1 }];
    const categoriesById = new Map([[1, MIRADOR]]);
    const el = panel(points, [], vi.fn(), { stops, categoriesById });

    const row = el.querySelector('[data-cy="route-detail-timeline-evento-parada"]');
    expect(row).not.toBeNull();
    expect(row!.querySelector('svg')).not.toBeNull();
    expect(row!.textContent).not.toContain('🌄');
    expect(row!.textContent).toContain('Mirador');
  });

  it('AC-6.4: una ruta sin ninguna parada tipada no muestra ningún delimitador de parada', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 1500, speed: 0 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    // Parada sin categoría resuelta en el catálogo (id inexistente en el Map) — se descarta entera.
    const stops: TimelineStopInput[] = [{ startTime: 1500, lat: 40.42, lng: -3.71, stopCategoryId: 99 }];
    const el = panel(points, [], vi.fn(), { stops, categoriesById: new Map() });

    expect(el.querySelector('[data-cy="route-detail-timeline-evento-parada"]')).toBeNull();
  });
});
