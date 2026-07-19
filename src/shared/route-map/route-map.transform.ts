export interface RouteMapPoint {
  lat: number;
  lng: number;
}

export type LngLat = [number, number];

export interface RouteLineFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'LineString';
    coordinates: LngLat[];
  };
}

export function toGeoJSON(points: readonly RouteMapPoint[]): RouteLineFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p): LngLat => [p.lng, p.lat]),
    },
  };
}

export function computeBounds(points: readonly RouteMapPoint[]): [LngLat, LngLat] | null {
  if (points.length === 0) return null;

  let minLng = points[0]!.lng;
  let maxLng = points[0]!.lng;
  let minLat = points[0]!.lat;
  let maxLat = points[0]!.lat;

  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
