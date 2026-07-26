/**
 * Construcción pura del `d` de un `<path>` SVG a partir de un trazado
 * simplificado (`previewPolyline`). Es una silueta, no una proyección
 * cartográfica fiel: lat/lng se normalizan de forma independiente por eje
 * para caber en el `viewBox` dado, sin preservar la proporción real de
 * distancias (decisión ya documentada en el plan de `mejoras-fotos-mapa`).
 */

/**
 * Devuelve el `d` de un `<path>` que dibuja el trazado dentro de un recuadro
 * `width` x `height`, o `null` si no hay suficientes puntos para dibujar una
 * línea (`null`, `[]` o un único punto) — el llamador debe caer al placeholder
 * en ese caso.
 */
export function buildPolylineSvgPath(
  polyline: [number, number][] | null,
  width: number,
  height: number,
): string | null {
  if (!polyline || polyline.length < 2) return null;

  const lats = polyline.map(([lat]) => lat);
  const lngs = polyline.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Evita división por cero cuando todos los puntos comparten lat o lng
  // (ej. un tramo perfectamente recto norte-sur o este-oeste).
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  const coords = polyline.map(([lat, lng]) => {
    const x = ((lng - minLng) / lngRange) * width;
    // Y invertida: mayor latitud (norte) → Y menor (arriba), como un mapa normal.
    const y = height - ((lat - minLat) / latRange) * height;
    return `${String(x)},${String(y)}`;
  });

  return `M${coords.join('L')}`;
}
