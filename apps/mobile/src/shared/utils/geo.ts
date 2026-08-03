/**
 * Utilidades geográficas puras, compartidas por `cockpit` y `routes`
 * (ver AC-001 de `specs/features/deuda-tecnica-auditoria.md`).
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula la distancia entre dos puntos GPS usando la fórmula Haversine.
 * Devuelve la distancia en kilómetros.
 */
export function calculateDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);
  const haversine =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}
