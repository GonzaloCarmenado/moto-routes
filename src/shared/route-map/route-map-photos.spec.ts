import { describe, it, expect, vi } from 'vitest';
import type { Photo } from '../models/photo.types.js';

// maplibre-gl toca window.URL.createObjectURL al importarse (no disponible en jsdom por
// defecto), y clusterPhotos no depende de maplibre-gl en absoluto — se mockea para poder
// testear el algoritmo de clustering de forma aislada.
vi.mock('maplibre-gl', () => ({ default: {}, Marker: vi.fn() }));

const { clusterPhotos, photoClusterRadiusForZoom } = await import('./route-map-photos.js');

function makePhoto(id: string, lat: number, lng: number): Photo {
  return {
    id,
    routeId: 'route-1',
    filePath: `photos/${id}.jpg`,
    latitude: lat,
    longitude: lng,
    capturedAt: '2026-07-20T10:00:00.000Z',
    createdAt: '2026-07-20T10:00:00.000Z',
  };
}

describe('clusterPhotos (AC-031)', () => {
  it('groups two photos taken ~15m apart into a single cluster', () => {
    // ~0.00013 grados de latitud ≈ 14-15m
    const a = makePhoto('a', 40.4168, -3.7038);
    const b = makePhoto('b', 40.41693, -3.7038);

    const clusters = clusterPhotos([a, b], 50);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.photos).toHaveLength(2);
  });

  it('keeps photos more than 50m apart as separate markers', () => {
    // ~0.001 grados de latitud ≈ 111m, muy por encima del radio de 50m
    const a = makePhoto('a', 40.4168, -3.7038);
    const b = makePhoto('b', 40.4178, -3.7038);

    const clusters = clusterPhotos([a, b], 50);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.photos.length)).toEqual([1, 1]);
  });

  it('computes the cluster centroid as the average of its photos coordinates', () => {
    const a = makePhoto('a', 40.0, -3.0);
    const b = makePhoto('b', 40.00001, -3.0); // ~1m, dentro del radio

    const clusters = clusterPhotos([a, b], 50);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.centerLat).toBeCloseTo(40.000005, 6);
    expect(clusters[0]?.centerLng).toBe(-3.0);
  });

  it('ignores photos without coordinates', () => {
    const withCoords = makePhoto('a', 40.4168, -3.7038);
    const withoutCoords: Photo = { ...makePhoto('b', 0, 0), latitude: null, longitude: null };

    const clusters = clusterPhotos([withCoords, withoutCoords], 50);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.photos).toEqual([withCoords]);
  });

  it('returns no clusters for an empty photo list', () => {
    expect(clusterPhotos([], 50)).toEqual([]);
  });
});

describe('photoClusterRadiusForZoom (AC-018)', () => {
  it('returns the base 50m radius at the reference zoom (15)', () => {
    expect(photoClusterRadiusForZoom(15)).toBeCloseTo(50, 5);
  });

  it('shrinks the radius when zooming in past the reference zoom', () => {
    expect(photoClusterRadiusForZoom(19)).toBeCloseTo(3.125, 5);
  });

  it('grows the radius when zooming out past the reference zoom', () => {
    expect(photoClusterRadiusForZoom(13)).toBeCloseTo(200, 5);
  });
});
