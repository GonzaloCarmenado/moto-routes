import { describe, it, expect } from 'vitest';
import { cloudRouteDetailToLocal } from './route-detail-cloud.transform.js';
import type { CloudRouteDetail } from '../../shared/http/route-cloud-api.service.js';

const detail: CloudRouteDetail = {
  id: 'cloud-1',
  createdAt: '2026-08-01T10:00:00.000Z',
  duration: 100,
  totalDistance: 20,
  avgSpeed: 40,
  status: 'completed',
  name: 'Ruta de la nube',
  notes: null,
  isFavorite: true,
  points: [{ timestamp: 1000, lat: 40.1, lng: -3.1, alt: 600, speed: 10 }],
  stops: [{ startTime: 1200, endTime: 1300, lat: 40.15, lng: -3.15, type: 'manual', stopCategoryId: 2 }],
};

describe('cloudRouteDetailToLocal', () => {
  it('adapta la ruta a Route con origin "remote" y previewPolyline null', () => {
    const { route } = cloudRouteDetailToLocal(detail);

    expect(route).toMatchObject({
      id: 'cloud-1',
      name: 'Ruta de la nube',
      origin: 'remote',
      previewPolyline: null,
      visibility: 'private',
      isFavorite: true,
    });
  });

  it('adapta los puntos y paradas con id/routeId sintetizados', () => {
    const { points, stops } = cloudRouteDetailToLocal(detail);

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ routeId: 'cloud-1', lat: 40.1, lng: -3.1 });
    expect(points[0]?.id).toBeTypeOf('string');

    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ routeId: 'cloud-1', startTime: 1200, stopCategoryId: 2 });
    expect(stops[0]?.id).toBeTypeOf('string');
  });

  it('sin puntos ni paradas, devuelve listas vacías', () => {
    const { points, stops } = cloudRouteDetailToLocal({ ...detail, points: [], stops: [] });

    expect(points).toEqual([]);
    expect(stops).toEqual([]);
  });
});
