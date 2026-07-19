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

/**
 * Convierte un color oklch(L C H) (con o sin "%" en L) a "rgb(r, g, b)".
 * Implementación pura (sin DOM/canvas): las APIs de canvas para leer color
 * (getImageData) pueden verse alteradas por protecciones anti-fingerprinting
 * del navegador (ej. Opera GX, extensiones de privacidad), que devuelven
 * datos vacíos/erróneos. Fórmulas estándar de conversión OKLab→sRGB lineal
 * (Björn Ottosson, https://bottosson.github.io/posts/oklab/).
 * Devuelve null si el string no tiene formato oklch(...) reconocible.
 */
export function oklchStringToRgb(input: string): string | null {
  const match = /oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)/i.exec(input.trim());
  if (!match) return null;

  const [, lRaw, percentSign, cRaw, hRaw] = match;
  const l = percentSign ? Number(lRaw) / 100 : Number(lRaw);
  const c = Number(cRaw);
  const h = Number(hRaw);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null;

  const [rLinear, gLinear, bLinear] = oklchToLinearSrgb(l, c, h);
  const r = linearToSrgb8bit(rLinear);
  const g = linearToSrgb8bit(gLinear);
  const b = linearToSrgb8bit(bLinear);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function oklchToLinearSrgb(l: number, c: number, hDegrees: number): [number, number, number] {
  const hRadians = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(hRadians);
  const b = c * Math.sin(hRadians);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;

  const r = 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g = -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const bLinear = -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed;

  return [r, g, bLinear];
}

function linearToSrgb8bit(channel: number): number {
  const clamped = Math.min(Math.max(channel, 0), 1);
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.min(Math.max(encoded, 0), 1) * 255);
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
