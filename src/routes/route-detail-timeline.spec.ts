import { describe, it, expect, vi } from 'vitest';
import { buildTimelinePanel } from './route-detail-timeline.js';
import type { RoutePoint } from '../shared/models/route.types.js';

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

describe('buildTimelinePanel (AC-009, AC-018)', () => {
  it('AC-018: Salida lleva data-cy correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = buildTimelinePanel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-salida"]')).not.toBeNull();
  });

  it('AC-018: Llegada lleva data-cy correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = buildTimelinePanel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-llegada"]')).not.toBeNull();
  });

  it('AC-018: foto lleva data-cy con su photoId', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const photos = [{ id: 'foto-1', capturedAt: new Date(1500).toISOString() }];
    const el = buildTimelinePanel(points, photos, vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-evento-foto-foto-1"]')).not.toBeNull();
  });

  it('AC-018: tramo lleva data-cy con su índice', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const el = buildTimelinePanel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-tramo-0"]')).not.toBeNull();
  });

  it('AC-009: pulsar un evento foto invoca onPhotoClick con el photoId correcto', () => {
    const points: RoutePoint[] = [
      makePt({ timestamp: 1000, speed: 50 }),
      makePt({ timestamp: 2000, speed: 50 }),
    ];
    const photos = [{ id: 'foto-1', capturedAt: new Date(1500).toISOString() }];
    const onClick = vi.fn();
    const el = buildTimelinePanel(points, photos, onClick);

    const btn = el.querySelector('[data-cy="route-detail-timeline-evento-foto-foto-1"]') as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onClick).toHaveBeenCalledWith('foto-1');
  });

  it('AC-017: sin GPS ni fotos muestra mensaje vacío', () => {
    const el = buildTimelinePanel([], [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-vacio"]')).not.toBeNull();
    // No debe haber eventos
    expect(el.querySelector('[data-cy^="route-detail-timeline-evento"]')).toBeNull();
  });

  it('AC-016: sin GPS suficiente pero con fotos muestra las fotos y el mensaje', () => {
    const photos = [{ id: 'foto-1', capturedAt: new Date(1000).toISOString() }];
    const el = buildTimelinePanel([], photos, vi.fn());
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
    const el = buildTimelinePanel(points, [], vi.fn());
    expect(el.querySelector('[data-cy="route-detail-timeline-vacio"]')).toBeNull();
  });
});