import { describe, it, expect, vi } from 'vitest';
import type { Photo } from '../models/photo.types.js';

// maplibre-gl toca window.URL.createObjectURL al importarse (no disponible en jsdom por
// defecto), y clusterPhotos no depende de maplibre-gl en absoluto — se mockea para poder
// testear el algoritmo de clustering de forma aislada.
vi.mock('maplibre-gl', () => ({ default: {}, Marker: vi.fn() }));

const { clusterPhotos, photoClusterRadiusForZoom, PHOTO_PROXIMITY_GROUP_RADIUS_METERS } =
  await import('./route-map-photos.js');

function makePhoto(id: string, lat: number, lng: number): Photo {
  return {
    id,
    routeId: 'route-1',
    filePath: `photos/${id}.jpg`,
    latitude: lat,
    longitude: lng,
    capturedAt: '2026-07-20T10:00:00.000Z',
    createdAt: '2026-07-20T10:00:00.000Z',
    remotePhotoId: null,
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

describe('agrupación por proximidad del visor (PHOTO_PROXIMITY_GROUP_RADIUS_METERS)', () => {
  it('is a fixed 75m radius, independent of the map zoom-scaled visual clustering radius', () => {
    expect(PHOTO_PROXIMITY_GROUP_RADIUS_METERS).toBe(75);
  });

  it('groups into a single zone photos from a stop (e.g. lunch) and keeps a separate zone for a distant viewpoint', () => {
    // Zona 1: 4 fotos de una comida, todas a pocos metros entre sí.
    const lunch = [
      makePhoto('l1', 40.4168, -3.7038),
      makePhoto('l2', 40.41681, -3.70381),
      makePhoto('l3', 40.41682, -3.7038),
      makePhoto('l4', 40.4168, -3.70379),
    ];
    // Zona 2: 23 fotos de un mirador, a ~500m de la comida — muy por encima del radio.
    const viewpoint = Array.from({ length: 23 }, (_, i) =>
      makePhoto(`v${i}`, 40.4213, -3.7038 + i * 0.000001),
    );

    const clusters = clusterPhotos([...lunch, ...viewpoint], PHOTO_PROXIMITY_GROUP_RADIUS_METERS);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.photos.length).sort((a, b) => a - b)).toEqual([4, 23]);
  });

  it('forms a single-photo group when no other route photo is within 75m', () => {
    const isolated = makePhoto('a', 40.4168, -3.7038);
    const farAway = makePhoto('b', 40.43, -3.72);

    const clusters = clusterPhotos([isolated, farAway], PHOTO_PROXIMITY_GROUP_RADIUS_METERS);

    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.photos.length === 1)).toBe(true);
  });

  it('clusters photos just under the 75m radius', () => {
    // ~0.000665 grados de latitud ≈ 74m, justo por debajo del radio.
    const a = makePhoto('a', 40.4168, -3.7038);
    const b = makePhoto('b', 40.417465, -3.7038);

    const clusters = clusterPhotos([a, b], PHOTO_PROXIMITY_GROUP_RADIUS_METERS);

    expect(clusters).toHaveLength(1);
  });

  it('does not cluster photos at or beyond the 75m radius (strict "<")', () => {
    // ~0.000683 grados de latitud ≈ 76m, justo por encima del radio.
    const a = makePhoto('a', 40.4168, -3.7038);
    const b = makePhoto('b', 40.417483, -3.7038);

    const clusters = clusterPhotos([a, b], PHOTO_PROXIMITY_GROUP_RADIUS_METERS);

    expect(clusters).toHaveLength(2);
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
