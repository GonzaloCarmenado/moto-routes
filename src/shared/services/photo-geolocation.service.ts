/**
 * Servicio puro para extraer coordenadas GPS de fotos.
 * Sin dependencias de DOM, Tauri ni infraestructura.
 * La función principal es `extractPhotoLocation`.
 */

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/**
 * Valida que unas coordenadas estén dentro de rangos geográficos aceptables.
 */
function isValidCoordinates(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= LAT_MIN &&
    lat <= LAT_MAX &&
    lng >= LNG_MIN &&
    lng <= LNG_MAX
  );
}

/**
 * Calcula el centroide (promedio) de un conjunto de puntos.
 * Si el array está vacío, devuelve undefined.
 */
function computeCentroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } | undefined {
  if (points.length === 0) return undefined;
  const sumLat = points.reduce((acc, p) => acc + p.lat, 0);
  const sumLng = points.reduce((acc, p) => acc + p.lng, 0);
  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length,
  };
}

// Tipo para el resultado de exifr.parse cuando tiene GPS
interface ExifGpsResult {
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Extrae la ubicación de una foto siguiendo esta prioridad:
 * 1. EXIF GPS de la imagen
 * 2. fallbackPoint (último punto de ruta activa, o punto central de ruta guardada)
 * 3. Centroide de routePoints (puntos GPS de la ruta completa)
 *
 * @param file - Archivo de imagen (File)
 * @param fallbackPoint - Punto de fallback individual (opcional)
 * @param routePoints - Array de puntos de la ruta para calcular centroide (opcional)
 * @returns Coordenadas {lat, lng} o null si no se pudo determinar ubicación
 */
export async function extractPhotoLocation(
  file: File,
  fallbackPoint?: { lat: number; lng: number },
  routePoints?: { lat: number; lng: number }[],
): Promise<{ lat: number; lng: number } | null> {
  // 1. Intentar obtener GPS desde EXIF
  try {
    const exifr = await import('exifr');
    const gps = await exifr.parse(file, { gps: true }) as ExifGpsResult | undefined;

    const glat = gps?.latitude;
    const glng = gps?.longitude;
    if (glat != null && glng != null && isValidCoordinates(glat, glng)) {
      return { lat: glat, lng: glng };
    }
  } catch {
    // Si exifr falla o no está disponible, continuar con fallbacks
  }

  // 2. Fallback: punto individual proporcionado
  if (fallbackPoint && isValidCoordinates(fallbackPoint.lat, fallbackPoint.lng)) {
    return { lat: fallbackPoint.lat, lng: fallbackPoint.lng };
  }

  // 3. Fallback: centroide de puntos de ruta
  if (routePoints && routePoints.length > 0) {
    const centroid = computeCentroid(routePoints);
    if (centroid && isValidCoordinates(centroid.lat, centroid.lng)) {
      return centroid;
    }
  }

  // 4. No se pudo determinar ubicación
  return null;
}