/**
 * Simplificado de trazado GPS mediante decimación uniforme.
 * Compartido entre `cockpit` (al parar una grabación) y `routes` (backfill
 * perezoso del listado) — no es específico de un dominio.
 *
 * Decisión ya tomada con el usuario (ver Notas de Implementación de la spec
 * `mejoras-fotos-mapa`): decimación uniforme en vez de Douglas-Peucker,
 * priorizando simplicidad/determinismo sobre fidelidad de la silueta.
 */

const MIN_TARGET_POINTS = 20;
const MAX_TARGET_POINTS = 40;

export interface PolylinePoint {
  lat: number;
  lng: number;
}

/**
 * Reduce una lista de puntos GPS a entre ~20 y ~40 puntos, conservando
 * siempre el primero y el último punto de la entrada. Con menos de
 * `MIN_TARGET_POINTS` puntos de entrada, se devuelven todos tal cual
 * (no se fabrican puntos que no existen). Con 0 puntos, devuelve `[]`.
 */
export function simplifyPolyline(points: PolylinePoint[]): [number, number][] {
  if (points.length === 0) return [];
  if (points.length <= MIN_TARGET_POINTS) {
    return points.map((p): [number, number] => [p.lat, p.lng]);
  }

  // Paso de decimación elegido para que, tras conservar 1 de cada N puntos,
  // el resultado no supere MAX_TARGET_POINTS (puede quedar algo por debajo
  // si la entrada es pequeña, nunca por debajo de MIN_TARGET_POINTS cuando
  // la entrada lo permite).
  const step = Math.max(1, Math.ceil(points.length / MAX_TARGET_POINTS));

  const decimated: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) {
    const p = points[i]!;
    decimated.push([p.lat, p.lng]);
  }

  const lastPoint = points[points.length - 1]!;
  const lastDecimated = decimated[decimated.length - 1]!;
  if (lastDecimated[0] !== lastPoint.lat || lastDecimated[1] !== lastPoint.lng) {
    decimated.push([lastPoint.lat, lastPoint.lng]);
  }

  return decimated;
}
